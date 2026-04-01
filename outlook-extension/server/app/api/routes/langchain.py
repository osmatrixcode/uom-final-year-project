import json
import logging
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Literal, Optional
from app.services.langchain_service import LangChainService
from app.services.token_validator import try_validate_token, ValidatedToken
from app.services.graph_service import get_email_thread, get_thread_by_conversation_id
from app.services.profile_service import get_profile, get_thread_note

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


def _fix_body_from_graph(request: "EmailContextRequest", graph_thread: dict | None, user_email: str | None):
    """
    Office.js body in reply-compose mode contains the user's own draft / quoted text,
    not the incoming email.  When Graph thread data is available, replace request.body
    with the most recent message actually sent BY the recipient so the prompt
    correctly says '{recipients} wrote this email'.
    """
    if not graph_thread or not user_email:
        return
    thread_msgs = graph_thread.get("thread", [])
    if not thread_msgs:
        return
    user = user_email.lower()
    # Most recent message NOT from the user = the incoming email
    for msg in reversed(thread_msgs):
        sender_addr = msg.get("from", {}).get("emailAddress", {}).get("address", "").lower()
        if sender_addr and sender_addr != user:
            body_text = msg.get("bodyFull") or msg.get("bodyPreview", "")
            if body_text:
                request.body = body_text
            return


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
    if request.mode != "general_qa":
        request.injected_context = _build_injected_context(request)
    reply, intent = service.generate_email_reply(request, graph_thread=graph_thread)
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
    if request.mode != "general_qa":
        request.injected_context = _build_injected_context(request)

    def event_stream():
        try:
            intent = "draft" if request.mode == "email_draft" else "qa"
            yield f"data: {json.dumps({'type': 'intent', 'intent': intent})}\n\n"

            for chunk in service.stream_email_reply(request, graph_thread=graph_thread, sender_name=user.name if user else None):
                yield f"data: {json.dumps({'type': 'token', 'token': chunk})}\n\n"

            yield f"data: {json.dumps({'type': 'done', 'user_name': user.name if user else None, 'graph_enriched': graph_thread is not None})}\n\n"
        except Exception as e:
            logger.error("Streaming error: %s", e)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
