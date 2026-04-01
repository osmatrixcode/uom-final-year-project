import logging
from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.services.profile_service import get_thread_note, save_thread_note
from app.services.graph_service import get_thread_by_conversation_id, graph_get_with_token, GRAPH_BASE
from app.services.langchain_service import LangChainService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/threads", tags=["threads"])


class ThreadNoteResponse(BaseModel):
    conversation_id: str
    note_text: str


class SaveThreadNoteRequest(BaseModel):
    note_text: str


@router.get("/{conversation_id}", response_model=ThreadNoteResponse)
def read_thread_note(conversation_id: str):
    """Return the stored note for a conversation thread. Returns empty string if none saved."""
    return ThreadNoteResponse(
        conversation_id=conversation_id,
        note_text=get_thread_note(conversation_id),
    )


@router.put("/{conversation_id}", response_model=ThreadNoteResponse)
def write_thread_note(conversation_id: str, body: SaveThreadNoteRequest):
    """Upsert the note for a conversation thread."""
    save_thread_note(conversation_id, body.note_text)
    return ThreadNoteResponse(conversation_id=conversation_id, note_text=body.note_text)


class GenerateThreadNoteRequest(BaseModel):
    current_email_subject: str = ""
    current_email_body: str = ""


def _extract_bearer(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    return auth.removeprefix("Bearer ").strip() if auth.startswith("Bearer ") else None


@router.post("/{conversation_id}/generate", response_model=ThreadNoteResponse)
def generate_thread_note(conversation_id: str, body: GenerateThreadNoteRequest, request: Request):
    """
    Auto-generate a note for this thread by looking at the user's own messages
    within the conversation. Falls back to current email body if none found.
    """
    token = _extract_bearer(request)
    history_preview = ""

    if token:
        try:
            # Get the user's email address for filtering
            me = graph_get_with_token(f"{GRAPH_BASE}/me?$select=mail,userPrincipalName", token)
            user_email = (me.get("mail") or me.get("userPrincipalName", "")).lower()

            # Get all thread messages
            thread_data = get_thread_by_conversation_id(conversation_id, token)
            thread_msgs = thread_data.get("thread", [])

            # Filter to messages sent BY the user
            user_msgs = [
                m for m in thread_msgs
                if m.get("from", {}).get("emailAddress", {}).get("address", "").lower() == user_email
            ]

            source_msgs = user_msgs if user_msgs else thread_msgs
            if source_msgs:
                previews = []
                for m in source_msgs:
                    sender = m.get("from", {}).get("emailAddress", {}).get("name", "Unknown")
                    date = m.get("receivedDateTime", "")[:10]
                    preview = m.get("bodyPreview", "")
                    previews.append(f"[{date}] {sender}: {preview}")
                history_preview = "\n\n".join(previews)
        except Exception as e:
            logger.warning("Could not fetch thread from Graph for %s: %s", conversation_id, e)

    service = LangChainService()
    generated = service.generate_profile_text(
        history_preview=history_preview,
        fallback_body=body.current_email_body,
        mode="thread",
    )
    save_thread_note(conversation_id, generated)
    return ThreadNoteResponse(conversation_id=conversation_id, note_text=generated)


class RefineThreadNoteRequest(BaseModel):
    current_text: str
    instruction: str


@router.post("/{conversation_id}/refine", response_model=ThreadNoteResponse)
def refine_thread_note(conversation_id: str, body: RefineThreadNoteRequest):
    """Refine the note for a thread using an AI instruction."""
    service = LangChainService()
    refined = service.refine_profile_text(body.current_text, body.instruction)
    return ThreadNoteResponse(conversation_id=conversation_id, note_text=refined)
