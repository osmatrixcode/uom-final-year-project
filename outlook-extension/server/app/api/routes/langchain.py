import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Literal, Optional
from app.services.langchain_service import LangChainService
from app.services.token_validator import try_validate_token, ValidatedToken
from app.services.graph_service import get_email_thread, get_thread_by_conversation_id
from app.services.profile_service import get_profile, get_thread_note
from app.services.moderation_service import check_moderation, ModerationFailure
from app.services.injection_service import check_injection, InjectionFailure
from app.services.prompt_logger import log_moderation_block, log_injection_block, log_anonymization
from app.services.anonymize_service import create_anonymizer, anonymize_text, deanonymize_text

logger = logging.getLogger(__name__)
router = APIRouter()


class EmailRecipient(BaseModel):
    displayName: str
    emailAddress: str


class EmailContextRequest(BaseModel):
    subject: str
    body: str
    recipients: List[EmailRecipient]
    draft: Optional[str] = None
    instruction: Optional[str] = None
    mode: Optional[str] = None
    # Optional: when provided, the backend fetches the full email thread from Graph
    # using the client's NAA token.
    item_rest_id: Optional[str] = None
    # conversationId is available in compose/reply mode when itemId is not yet set
    conversation_id: Optional[str] = None
    # Personalisation context injected from SQLite profiles + thread notes
    injected_context: Optional[str] = None


class GenerateReplyResponse(BaseModel):
    reply: str
    user_name: Optional[str] = None
    graph_enriched: bool = False  # True when reply used Graph API thread data
    intent: Literal["draft", "qa"] = "draft"


def get_langchain_service():
    return LangChainService()


def _build_injected_context(request: "EmailContextRequest") -> str | None:
    """Load per-sender profiles and thread note from SQLite and combine into a context block."""
    blocks = []
    for r in request.recipients:
        p = get_profile(r.emailAddress)
        if p:
            blocks.append(f"Notes on {r.displayName or r.emailAddress}: {p}")
    if request.conversation_id:
        tn = get_thread_note(request.conversation_id)
        if tn:
            blocks.append(f"Thread note: {tn}")
    if not blocks:
        return None
    return "\n\n---\nPersonalisation context (use to tailor tone and style):\n" + "\n".join(blocks)


def _normalize(text: str) -> str:
    """Strip all whitespace and punctuation for fuzzy comparison."""
    return "".join(text.lower().split())


def _fix_body_from_graph(request: "EmailContextRequest", graph_thread: dict | None, user_email: str | None):
    """
    Office.js body in reply-compose mode contains the user's own draft / quoted text,
    not the incoming email.  When Graph thread data is available, replace request.body
    with the most recent message actually sent BY the recipient so the prompt
    correctly says '{recipients} wrote this email'.

    Also clears request.draft if it's just the quoted incoming email (no actual user draft).
    """
    if not graph_thread or not user_email:
        return
    thread_msgs = graph_thread.get("thread", [])
    if not thread_msgs:
        return
    user = user_email.lower()
    incoming_body = ""
    # Most recent message NOT from the user = the incoming email
    for msg in reversed(thread_msgs):
        sender_addr = msg.get("from", {}).get("emailAddress", {}).get("address", "").lower()
        if sender_addr and sender_addr != user:
            incoming_body = msg.get("bodyFull") or msg.get("bodyPreview", "")
            if incoming_body:
                request.body = incoming_body
            break

    # If the draft is essentially the quoted incoming email, clear it so the
    # system uses generate_reply (new draft) instead of refine_draft.
    if request.draft and incoming_body:
        from app.services.langchain_service import _strip_officejs_header_prefix
        cleaned_draft = _strip_officejs_header_prefix(request.draft)
        norm_draft = _normalize(cleaned_draft)
        norm_body = _normalize(incoming_body)
        # Exact match, or one contains the other (quoted text may be subset)
        if norm_draft == norm_body or norm_body in norm_draft or norm_draft in norm_body:
            logger.info("[fix-body] Clearing draft — it matches the incoming email (not a user draft)")
            request.draft = None


def _collect_known_names(request: "EmailContextRequest", user_name: str | None) -> list[str]:
    """Gather names that must be force-anonymized (recipients + logged-in user)."""
    names: list[str] = []
    for r in request.recipients:
        if r.displayName:
            names.append(r.displayName)
            for part in r.displayName.split():
                if len(part) > 1:
                    names.append(part)
    if user_name:
        names.append(user_name)
        for part in user_name.split():
            if len(part) > 1:
                names.append(part)
    return names


def _anonymize_request(request: "EmailContextRequest", anon_scanner, graph_thread: dict | None = None):
    """Anonymize PII-bearing fields on *request* and *graph_thread* in place.

    Returns originals dict for logging.
    """
    originals = {
        "subject": request.subject,
        "body": request.body,
        "instruction": request.instruction,
    }
    request.subject = anonymize_text(request.subject, anon_scanner)
    request.body = anonymize_text(request.body, anon_scanner)
    if request.instruction:
        request.instruction = anonymize_text(request.instruction, anon_scanner)

    # Anonymize recipient display names (used to build recipients_str in the service)
    for r in request.recipients:
        if r.displayName:
            r.displayName = anonymize_text(r.displayName, anon_scanner)
        if r.emailAddress:
            r.emailAddress = anonymize_text(r.emailAddress, anon_scanner)

    # Anonymize Graph thread messages (sender names + body text)
    if graph_thread:
        for msg in graph_thread.get("thread", []):
            email_addr = msg.get("from", {}).get("emailAddress", {})
            if email_addr.get("name"):
                email_addr["name"] = anonymize_text(email_addr["name"], anon_scanner)
            if msg.get("bodyFull"):
                msg["bodyFull"] = anonymize_text(msg["bodyFull"], anon_scanner)
            if msg.get("bodyPreview"):
                msg["bodyPreview"] = anonymize_text(msg["bodyPreview"], anon_scanner)

    return originals


def _extract_bearer_token(request: Request) -> str | None:
    auth_header = request.headers.get("Authorization", "")
    return auth_header.removeprefix("Bearer ").strip() if auth_header.startswith("Bearer ") else None


def get_current_user(request: Request) -> ValidatedToken | None:
    """Extract and validate the NAA Bearer token from the Authorization header."""
    return try_validate_token(_extract_bearer_token(request))


@router.get("/langchain-hello")
def say_langchain_hello(service: LangChainService = Depends(get_langchain_service)):
    response = service.get_hello()
    return {"message": response}


@router.post("/generate-reply", response_model=GenerateReplyResponse)
def generate_reply(
    request: EmailContextRequest,
    http_request: Request,
    service: LangChainService = Depends(get_langchain_service),
):
    user = get_current_user(http_request)
    token = _extract_bearer_token(http_request)

    # If the client sent a Graph-compatible ID, fetch the thread
    graph_thread: dict | None = None
    if token:
        try:
            if request.item_rest_id:
                graph_thread = get_email_thread(request.item_rest_id, token)
            elif request.conversation_id:
                graph_thread = get_thread_by_conversation_id(request.conversation_id, token)
        except Exception as e:
            # Non-fatal: fall back to the email context provided by the client
            logger.warning("Could not fetch email thread from Graph: %s", e)

    _fix_body_from_graph(request, graph_thread, user.email if user else None)

    # --- Moderation gate (general_qa only): check user instruction BEFORE template rendering ---
    if request.mode == "general_qa" or request.mode is None:
        try:
            check_moderation(request.instruction)
        except ModerationFailure as exc:
            log_moderation_block(
                instruction=request.instruction or "",
                categories=exc.categories,
                mode=request.mode or "general_qa",
            )
            raise HTTPException(
                status_code=422,
                detail=f"Your message was flagged by our content policy ({', '.join(exc.categories)}). Please rephrase.",
            )
        try:
            check_injection(request.instruction)
        except InjectionFailure as exc:
            log_injection_block(
                instruction=request.instruction or "",
                scanner_name=exc.scanner_name,
                risk_score=exc.risk_score,
                mode=request.mode or "general_qa",
            )
            raise HTTPException(
                status_code=422,
                detail="Your message was flagged by our security filter. Please rephrase.",
            )

    if request.mode != "general_qa":
        request.injected_context = _build_injected_context(request)

    # --- PII anonymization (general_qa only) ---
    deanon_scanner = None
    anon_prompt_snapshot = None
    originals = None
    if request.mode == "general_qa" or request.mode is None:
        known = _collect_known_names(request, user.name if user else None)
        _vault, anon_scanner, deanon_scanner = create_anonymizer(hidden_names=known)
        originals = _anonymize_request(request, anon_scanner, graph_thread)
        anon_prompt_snapshot = f"subject: {request.subject}\nbody: {request.body}\ninstruction: {request.instruction}"

    reply, intent = service.generate_email_reply(request, graph_thread=graph_thread)

    # --- PII deanonymization ---
    if deanon_scanner and anon_prompt_snapshot:
        anon_reply = reply
        reply = deanonymize_text(anon_prompt_snapshot, reply, deanon_scanner)
        log_anonymization(
            prompt_before=f"subject: {originals['subject']}\nbody: {originals['body']}\ninstruction: {originals['instruction']}",
            prompt_after=anon_prompt_snapshot,
            output_before=anon_reply,
            output_after=reply,
            mode=request.mode or "general_qa",
        )

    return GenerateReplyResponse(
        reply=reply,
        user_name=user.name if user else None,
        graph_enriched=graph_thread is not None,
        intent=intent,
    )


@router.post("/generate-reply/stream")
def generate_reply_stream(
    request: EmailContextRequest,
    http_request: Request,
    service: LangChainService = Depends(get_langchain_service),
):
    user = get_current_user(http_request)
    token = _extract_bearer_token(http_request)

    graph_thread: dict | None = None
    if token:
        try:
            if request.item_rest_id:
                graph_thread = get_email_thread(request.item_rest_id, token)
            elif request.conversation_id:
                graph_thread = get_thread_by_conversation_id(request.conversation_id, token)
        except Exception as e:
            logger.warning("Could not fetch email thread from Graph: %s", e)

    _fix_body_from_graph(request, graph_thread, user.email if user else None)

    # --- Moderation gate (general_qa only): check user instruction BEFORE template rendering ---
    if request.mode == "general_qa" or request.mode is None:
        try:
            check_moderation(request.instruction)
        except ModerationFailure as exc:
            log_moderation_block(
                instruction=request.instruction or "",
                categories=exc.categories,
                mode=request.mode or "general_qa",
            )
            raise HTTPException(
                status_code=422,
                detail=f"Your message was flagged by our content policy ({', '.join(exc.categories)}). Please rephrase.",
            )
        try:
            check_injection(request.instruction)
        except InjectionFailure as exc:
            log_injection_block(
                instruction=request.instruction or "",
                scanner_name=exc.scanner_name,
                risk_score=exc.risk_score,
                mode=request.mode or "general_qa",
            )
            raise HTTPException(
                status_code=422,
                detail="Your message was flagged by our security filter. Please rephrase.",
            )

    if request.mode != "general_qa":
        request.injected_context = _build_injected_context(request)

    # --- PII anonymization (general_qa only) ---
    deanon_scanner = None
    anon_prompt_snapshot = None
    originals = None
    if request.mode == "general_qa" or request.mode is None:
        known = _collect_known_names(request, user.name if user else None)
        _vault, anon_scanner, deanon_scanner = create_anonymizer(hidden_names=known)
        originals = _anonymize_request(request, anon_scanner, graph_thread)
        anon_prompt_snapshot = f"subject: {request.subject}\nbody: {request.body}\ninstruction: {request.instruction}"

    def event_stream():
        try:
            intent = "draft" if request.mode == "email_draft" else "qa"
            yield f"data: {json.dumps({'type': 'intent', 'intent': intent})}\n\n"

            full_output_chunks = []
            for chunk in service.stream_email_reply(request, graph_thread=graph_thread, sender_name=user.name if user else None):
                if chunk == "__SAFETY_BLOCK__":
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Your question appears to be outside the scope of this email thread. I can only help with questions about this email or email-related tasks.'})}\n\n"
                    return
                full_output_chunks.append(chunk)

            anon_output = "".join(full_output_chunks)

            # Deanonymize before sending to client
            if deanon_scanner and anon_prompt_snapshot:
                final_output = deanonymize_text(anon_prompt_snapshot, anon_output, deanon_scanner)
                log_anonymization(
                    prompt_before=f"subject: {originals['subject']}\nbody: {originals['body']}\ninstruction: {originals['instruction']}",
                    prompt_after=anon_prompt_snapshot,
                    output_before=anon_output,
                    output_after=final_output,
                    mode=request.mode or "general_qa",
                )
            else:
                final_output = anon_output

            yield f"data: {json.dumps({'type': 'token', 'token': final_output})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'user_name': user.name if user else None, 'graph_enriched': graph_thread is not None})}\n\n"
        except Exception as e:
            logger.error("Streaming error: %s", e)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
