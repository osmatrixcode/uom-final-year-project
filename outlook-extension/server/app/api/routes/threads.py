from fastapi import APIRouter
from pydantic import BaseModel

from app.services.profile_service import get_thread_note, save_thread_note

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
