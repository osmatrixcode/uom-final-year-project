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
from app.services.injection_service import check_injection, check_body_injection, InjectionFailure
from app.services.prompt_logger import log_prompt_and_response, log_moderation_block, log_injection_block, log_anonymization, log_safety_block
from app.services.anonymize_service import create_anonymizer, anonymize_text, deanonymize_text
from app.services.safety_service import check_safety, SafetyFailure

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
            blocks.append(f"Sender profile (general default) for {r.displayName or r.emailAddress}: {p}")
    if request.conversation_id:
        tn = get_thread_note(request.conversation_id)
        if tn:
            blocks.append(f"Thread note (thread-specific, takes priority over sender profile): {tn}")
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


def _snapshot_thread_context(graph_thread: dict | None) -> str:
    """Build a human-readable thread context string (same format as the service)."""
    if not graph_thread:
        return ""
    thread_messages = graph_thread.get("thread", [])
    if not thread_messages:
        return ""
    summaries = []
    for msg in thread_messages:
        sender = msg.get("from", {}).get("emailAddress", {}).get("name", "Unknown")
        preview = msg.get("bodyFull") or msg.get("bodyPreview", "")
        date = msg.get("receivedDateTime", "")[:10]
        summaries.append(f"[{date}] {sender}: {preview}")
    return "\n\nConversation history (from Microsoft Graph):\n" + "\n".join(summaries)


def _anonymize_request(request: "EmailContextRequest", anon_scanner, graph_thread: dict | None = None):
    """Anonymize PII-bearing fields on *request* and *graph_thread* in place.

    Returns originals dict for logging (including thread context snapshot).
    """
    # Snapshot originals BEFORE mutation
    originals = {
        "subject": request.subject,
        "body": request.body,
        "instruction": request.instruction,
        "thread_context": _snapshot_thread_context(graph_thread),
    }

    request.subject = anonymize_text(request.subject, anon_scanner)
    request.body = anonymize_text(request.body, anon_scanner)
    if request.instruction:
        request.instruction = anonymize_text(request.instruction, anon_scanner)
    if request.draft:
        originals["draft"] = request.draft
        request.draft = anonymize_text(request.draft, anon_scanner)

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

    mode = request.mode or "general_qa"

    if mode == "email_draft":
        request.injected_context = _build_injected_context(request)

        # ── EMAIL DRAFT PIPELINE ──────────────────────────────────────
        # ── INPUT GUARDS ──

        # 1. PII anonymize
        known = _collect_known_names(request, user.name if user else None)
        _vault, anon_scanner, deanon_scanner = create_anonymizer(hidden_names=known)
        originals = _anonymize_request(request, anon_scanner, graph_thread)
        anon_thread_context = _snapshot_thread_context(graph_thread)
        anon_prompt_snapshot = f"subject: {request.subject}\nbody: {request.body}{anon_thread_context}\ninstruction: {request.instruction}"

        # 2. Injection check — block malicious user input
        try:
            check_injection(request.instruction)
        except InjectionFailure as exc:
            log_injection_block(instruction=request.instruction or "", scanner_name=exc.scanner_name, risk_score=exc.risk_score, mode=mode)
            raise HTTPException(status_code=422, detail="Your message was flagged by our security filter. Please rephrase.")

        # 2b. Body injection check
        try:
            check_body_injection(request.body)
        except InjectionFailure as exc:
            log_injection_block(instruction="[email body]", scanner_name=exc.scanner_name, risk_score=exc.risk_score, mode=mode)
            raise HTTPException(status_code=422, detail="The email content contains suspicious hidden text.")

        # 3. Moderation check — block harmful user input
        try:
            check_moderation(request.instruction)
        except ModerationFailure as exc:
            log_moderation_block(instruction=request.instruction or "", categories=exc.categories, mode=mode)
            raise HTTPException(status_code=422, detail=f"Your message was flagged by our content policy ({', '.join(exc.categories)}). Please rephrase.")

        # ── MODEL ──

        # 4. LLM call
        anon_reply, intent = service.generate_email_reply(request, graph_thread=graph_thread)

        # ── OUTPUT GUARDS ──

        # 5. Scope classifier — verify output is a proper email reply
        try:
            check_safety(request.instruction, anon_reply, classifier_key="email_draft")
        except SafetyFailure as exc:
            log_safety_block(instruction=request.instruction or "", llm_output=anon_reply, reason=exc.reason, mode=mode)
            return GenerateReplyResponse(
                reply="The generated draft didn't look like a proper email reply. "
                      "Please try again or adjust your instruction.",
                user_name=user.name if user else None,
                graph_enriched=graph_thread is not None,
                intent="draft",
            )

        # 6. Output injection check
        try:
            check_injection(anon_reply)
        except InjectionFailure as exc:
            log_injection_block(instruction=anon_reply, scanner_name=exc.scanner_name, risk_score=exc.risk_score, mode=mode)
            raise HTTPException(status_code=422, detail="The response was flagged by our security filter.")

        # 7. Output moderation
        try:
            check_moderation(anon_reply)
        except ModerationFailure as exc:
            log_moderation_block(instruction=anon_reply, categories=exc.categories, mode=mode)
            raise HTTPException(status_code=422, detail=f"The response was flagged by our content policy ({', '.join(exc.categories)}).")

        # 8. Deanonymize — restore names, return to user
        reply = deanonymize_text(anon_prompt_snapshot, anon_reply, deanon_scanner)

        log_anonymization(prompt_after=anon_prompt_snapshot, output_before=anon_reply, mode=mode)
        log_prompt_and_response(
            prompt_key="email_draft", mode=mode,
            variables=originals,
            rendered_system=None,
            rendered_human=f"subject: {originals['subject']}\nbody: {originals['body']}{originals['thread_context']}\ninstruction: {originals['instruction']}",
            output=reply,
        )

        return GenerateReplyResponse(
            reply=reply,
            user_name=user.name if user else None,
            graph_enriched=graph_thread is not None,
            intent=intent,
        )

    elif mode != "general_qa":
        # Fallback for any future mode — unguarded
        request.injected_context = _build_injected_context(request)
        reply, intent = service.generate_email_reply(request, graph_thread=graph_thread)
        return GenerateReplyResponse(
            reply=reply,
            user_name=user.name if user else None,
            graph_enriched=graph_thread is not None,
            intent=intent,
        )

    # ── GENERAL QA PIPELINE ────────────────────────────────────────
    # ── INPUT GUARDS ──

    # 1. PII anonymize — protect PII from all downstream services
    known = _collect_known_names(request, user.name if user else None)
    _vault, anon_scanner, deanon_scanner = create_anonymizer(hidden_names=known)
    originals = _anonymize_request(request, anon_scanner, graph_thread)
    anon_thread_context = _snapshot_thread_context(graph_thread)
    anon_prompt_snapshot = f"subject: {request.subject}\nbody: {request.body}{anon_thread_context}\ninstruction: {request.instruction}"

    # 2. Injection check — block malicious user input
    try:
        check_injection(request.instruction)
    except InjectionFailure as exc:
        log_injection_block(instruction=request.instruction or "", scanner_name=exc.scanner_name, risk_score=exc.risk_score, mode=mode)
        raise HTTPException(status_code=422, detail="Your message was flagged by our security filter. Please rephrase.")

    # 2b. Body injection check — scan untrusted email content
    #     Invisible text → hard block; ML injection → log only (can't rephrase someone else's email)
    try:
        check_body_injection(request.body)
    except InjectionFailure as exc:
        log_injection_block(instruction="[email body]", scanner_name=exc.scanner_name, risk_score=exc.risk_score, mode=mode)
        raise HTTPException(status_code=422, detail="The email content contains suspicious hidden text.")

    # 3. Moderation check — block harmful user input
    try:
        check_moderation(request.instruction)
    except ModerationFailure as exc:
        log_moderation_block(instruction=request.instruction or "", categories=exc.categories, mode=mode)
        raise HTTPException(status_code=422, detail=f"Your message was flagged by our content policy ({', '.join(exc.categories)}). Please rephrase.")

    # ── MODEL ──

    # 4. LLM call
    anon_reply, intent = service.generate_email_reply(request, graph_thread=graph_thread)

    # ── OUTPUT GUARDS ──

    # 5. Scope classifier — block off-topic responses
    try:
        check_safety(request.instruction, anon_reply)
    except SafetyFailure as exc:
        log_safety_block(instruction=request.instruction or "", llm_output=anon_reply, reason=exc.reason, mode=mode)
        return GenerateReplyResponse(
            reply="Your question appears to be outside the scope of this email thread. "
                  "I can only help with questions about this email or email-related tasks.",
            user_name=user.name if user else None,
            graph_enriched=graph_thread is not None,
            intent="qa",
        )

    # 6. Output injection check — block if LLM output contains injection patterns
    try:
        check_injection(anon_reply)
    except InjectionFailure as exc:
        log_injection_block(instruction=anon_reply, scanner_name=exc.scanner_name, risk_score=exc.risk_score, mode=mode)
        raise HTTPException(status_code=422, detail="The response was flagged by our security filter.")

    # 7. Output moderation — block if LLM output is harmful
    try:
        check_moderation(anon_reply)
    except ModerationFailure as exc:
        log_moderation_block(instruction=anon_reply, categories=exc.categories, mode=mode)
        raise HTTPException(status_code=422, detail=f"The response was flagged by our content policy ({', '.join(exc.categories)}).")

    # 8. Deanonymize — restore names, return to user
    reply = deanonymize_text(anon_prompt_snapshot, anon_reply, deanon_scanner)

    # Log: anonymization view (what the model saw)
    log_anonymization(prompt_after=anon_prompt_snapshot, output_before=anon_reply, mode=mode)
    # Log: real-world view (original input, deanonymized output)
    log_prompt_and_response(
        prompt_key="general_qa", mode=mode,
        variables=originals,
        rendered_system=None,
        rendered_human=f"subject: {originals['subject']}\nbody: {originals['body']}{originals['thread_context']}\ninstruction: {originals['instruction']}",
        output=reply,
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

    mode = request.mode or "general_qa"

    if mode != "general_qa":
        request.injected_context = _build_injected_context(request)

    # ── INPUT GUARDS (steps 1-3) — general_qa & email_draft ─────
    # Run outside generator so HTTPException works (can't raise inside a generator)
    deanon_scanner = None
    anon_prompt_snapshot = None
    originals = None
    if mode in ("general_qa", "email_draft"):
        # 1. PII anonymize — protect PII from all downstream services
        known = _collect_known_names(request, user.name if user else None)
        _vault, anon_scanner, deanon_scanner = create_anonymizer(hidden_names=known)
        originals = _anonymize_request(request, anon_scanner, graph_thread)
        anon_thread_context = _snapshot_thread_context(graph_thread)
        anon_prompt_snapshot = f"subject: {request.subject}\nbody: {request.body}{anon_thread_context}\ninstruction: {request.instruction}"

        # 2. Injection check — block malicious user input
        try:
            check_injection(request.instruction)
        except InjectionFailure as exc:
            log_injection_block(instruction=request.instruction or "", scanner_name=exc.scanner_name, risk_score=exc.risk_score, mode=mode)
            raise HTTPException(status_code=422, detail="Your message was flagged by our security filter. Please rephrase.")

        # 2b. Body injection check — scan untrusted email content
        try:
            check_body_injection(request.body)
        except InjectionFailure as exc:
            log_injection_block(instruction="[email body]", scanner_name=exc.scanner_name, risk_score=exc.risk_score, mode=mode)
            raise HTTPException(status_code=422, detail="The email content contains suspicious hidden text.")

        # 3. Moderation check — block harmful user input
        try:
            check_moderation(request.instruction)
        except ModerationFailure as exc:
            log_moderation_block(instruction=request.instruction or "", categories=exc.categories, mode=mode)
            raise HTTPException(status_code=422, detail=f"Your message was flagged by our content policy ({', '.join(exc.categories)}). Please rephrase.")

    def event_stream():
        try:
            intent = "draft" if mode == "email_draft" else "qa"
            yield f"data: {json.dumps({'type': 'intent', 'intent': intent})}\n\n"

            # 4. LLM call
            full_output_chunks = []
            for chunk in service.stream_email_reply(request, graph_thread=graph_thread, sender_name=user.name if user else None):
                full_output_chunks.append(chunk)
            anon_output = "".join(full_output_chunks)

            if mode == "email_draft":
                # ── EMAIL DRAFT OUTPUT GUARDS (steps 5-7) ──

                # 5. Scope classifier — verify output is a proper email reply
                try:
                    check_safety(request.instruction, anon_output, classifier_key="email_draft")
                except SafetyFailure as exc:
                    log_safety_block(instruction=request.instruction or "", llm_output=anon_output, reason=exc.reason, mode=mode)
                    msg = "The generated draft didn't look like a proper email reply. Please try again or adjust your instruction."
                    yield f"data: {json.dumps({'type': 'error', 'message': msg})}\n\n"
                    return

                # 6. Output injection check
                try:
                    check_injection(anon_output)
                except InjectionFailure as exc:
                    log_injection_block(instruction=anon_output, scanner_name=exc.scanner_name, risk_score=exc.risk_score, mode=mode)
                    yield f"data: {json.dumps({'type': 'error', 'message': 'The response was flagged by our security filter.'})}\n\n"
                    return

                # 7. Output moderation
                try:
                    check_moderation(anon_output)
                except ModerationFailure as exc:
                    log_moderation_block(instruction=anon_output, categories=exc.categories, mode=mode)
                    yield f"data: {json.dumps({'type': 'error', 'message': 'The response was flagged by our content policy.'})}\n\n"
                    return

                # 8. Deanonymize
                reply = deanonymize_text(anon_prompt_snapshot, anon_output, deanon_scanner)

                log_anonymization(prompt_after=anon_prompt_snapshot, output_before=anon_output, mode=mode)
                log_prompt_and_response(
                    prompt_key="email_draft", mode=mode,
                    variables=originals,
                    rendered_system=None,
                    rendered_human=f"subject: {originals['subject']}\nbody: {originals['body']}{originals['thread_context']}\ninstruction: {originals['instruction']}",
                    output=reply,
                )

                yield f"data: {json.dumps({'type': 'token', 'token': reply})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'user_name': user.name if user else None, 'graph_enriched': graph_thread is not None})}\n\n"
                return

            elif mode != "general_qa":
                # Fallback for any future mode — unguarded
                yield f"data: {json.dumps({'type': 'token', 'token': anon_output})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'user_name': user.name if user else None, 'graph_enriched': graph_thread is not None})}\n\n"
                return

            # ── GENERAL QA OUTPUT GUARDS (steps 5-7) ──

            # 5. Scope classifier — block off-topic responses
            try:
                check_safety(request.instruction, anon_output)
            except SafetyFailure as exc:
                log_safety_block(instruction=request.instruction or "", llm_output=anon_output, reason=exc.reason, mode=mode)
                yield f"data: {json.dumps({'type': 'error', 'message': 'Your question appears to be outside the scope of this email thread. I can only help with questions about this email or email-related tasks.'})}\n\n"
                return

            # 6. Output injection check — block if LLM output contains injection patterns
            try:
                check_injection(anon_output)
            except InjectionFailure as exc:
                log_injection_block(instruction=anon_output, scanner_name=exc.scanner_name, risk_score=exc.risk_score, mode=mode)
                yield f"data: {json.dumps({'type': 'error', 'message': 'The response was flagged by our security filter.'})}\n\n"
                return

            # 7. Output moderation — block if LLM output is harmful
            try:
                check_moderation(anon_output)
            except ModerationFailure as exc:
                log_moderation_block(instruction=anon_output, categories=exc.categories, mode=mode)
                yield f"data: {json.dumps({'type': 'error', 'message': 'The response was flagged by our content policy.'})}\n\n"
                return

            # 8. Deanonymize — restore names, return to user
            reply = deanonymize_text(anon_prompt_snapshot, anon_output, deanon_scanner)

            # Log: anonymization view (what the model saw)
            log_anonymization(prompt_after=anon_prompt_snapshot, output_before=anon_output, mode=mode)
            # Log: real-world view (original input, deanonymized output)
            log_prompt_and_response(
                prompt_key="general_qa", mode=mode,
                variables=originals,
                rendered_system=None,
                rendered_human=f"subject: {originals['subject']}\nbody: {originals['body']}{originals['thread_context']}\ninstruction: {originals['instruction']}",
                output=reply,
            )

            yield f"data: {json.dumps({'type': 'token', 'token': reply})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'user_name': user.name if user else None, 'graph_enriched': graph_thread is not None})}\n\n"
        except Exception as e:
            logger.error("Streaming error: %s", e)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
