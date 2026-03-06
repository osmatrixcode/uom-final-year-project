import logging
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from typing import List, Optional
from app.services.langchain_service import LangChainService
from app.services.token_validator import try_validate_token, ValidatedToken
from app.services.graph_service import get_email_thread, get_thread_by_conversation_id

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
    # Optional: when provided, the backend fetches the full email thread from Graph
    # using the client's NAA token.
    item_rest_id: Optional[str] = None
    # conversationId is available in compose/reply mode when itemId is not yet set
    conversation_id: Optional[str] = None


class GenerateReplyResponse(BaseModel):
    reply: str
    user_name: Optional[str] = None
    graph_enriched: bool = False  # True when reply used Graph API thread data
    intent: str = "draft"  # "draft" | "qa"


def get_langchain_service():
    return LangChainService()


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

    reply, intent = service.generate_email_reply(request, graph_thread=graph_thread)
    return GenerateReplyResponse(
        reply=reply,
        user_name=user.name if user else None,
        graph_enriched=graph_thread is not None,
        intent=intent,
    )
