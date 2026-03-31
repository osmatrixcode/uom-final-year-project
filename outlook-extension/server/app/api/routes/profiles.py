from fastapi import APIRouter
from pydantic import BaseModel

from app.services.profile_service import get_profile, save_profile, delete_profile

router = APIRouter(prefix="/profiles", tags=["profiles"])


class ProfileResponse(BaseModel):
    email: str
    prompt_text: str


class SaveProfileRequest(BaseModel):
    prompt_text: str


@router.get("/{email}", response_model=ProfileResponse)
def read_profile(email: str):
    """Return the stored prompt_text for a sender. Returns empty string if none saved."""
    return ProfileResponse(email=email, prompt_text=get_profile(email))


@router.put("/{email}", response_model=ProfileResponse)
def write_profile(email: str, body: SaveProfileRequest):
    """Upsert the prompt_text for a sender."""
    save_profile(email, body.prompt_text)
    return ProfileResponse(email=email, prompt_text=body.prompt_text)


@router.delete("/{email}")
def remove_profile(email: str):
    """Delete the profile for a sender."""
    delete_profile(email)
    return {"ok": True}
