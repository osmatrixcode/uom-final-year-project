import logging
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional

from app.services.profile_service import get_profile, save_profile, delete_profile
from app.services.graph_service import graph_get_with_token, html_to_text, GRAPH_BASE
from app.services.sender_edit_guards import guarded_generate, guarded_refine

logger = logging.getLogger(__name__)

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


class GenerateProfileRequest(BaseModel):
    current_email_subject: str = ""
    current_email_body: str = ""


def _extract_bearer(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    return auth.removeprefix("Bearer ").strip() if auth.startswith("Bearer ") else None


@router.post("/{email}/generate", response_model=ProfileResponse)
def generate_profile(email: str, body: GenerateProfileRequest, request: Request):
    """
    Auto-generate a prompt_text for this sender by looking at the user's own
    sent emails to this person. Falls back to the current email body if none found.
    """
    token = _extract_bearer(request)
    history_preview = ""

    if token:
        try:
            # Graph rejects toRecipients/any() on consumer mailboxes,
            # so fetch recent sent items and filter client-side.
            result = graph_get_with_token(
                f"{GRAPH_BASE}/me/mailFolders/SentItems/messages"
                f"?$top=50"
                f"&$select=bodyPreview,body,subject,sentDateTime,toRecipients"
                f"&$orderby=sentDateTime desc",
                token,
            )
            target = email.lower()
            messages = [
                m for m in result.get("value", [])
                if any(
                    r.get("emailAddress", {}).get("address", "").lower() == target
                    for r in m.get("toRecipients", [])
                )
            ][:5]
            if messages:
                previews = []
                for m in messages:
                    date = m.get("sentDateTime", "")[:10]
                    subj = m.get("subject", "")
                    body_obj = m.get("body", {})
                    if body_obj.get("contentType") == "html":
                        body_text = html_to_text(body_obj.get("content", ""))
                    else:
                        body_text = body_obj.get("content", "").strip() or m.get("bodyPreview", "")
                    previews.append(f"[{date}] Subject: {subj}\n{body_text}")
                history_preview = "\n\n".join(previews)
        except Exception as e:
            logger.warning("Could not fetch sent items from Graph for %s: %s", email, e)

    generated = guarded_generate(
        history_preview=history_preview,
        fallback_body=body.current_email_body,
        mode="sender",
        name=email,
    )
    save_profile(email, generated)
    return ProfileResponse(email=email, prompt_text=generated)


class RefineProfileRequest(BaseModel):
    current_text: str
    instruction: str


@router.post("/{email}/refine", response_model=ProfileResponse)
def refine_profile(email: str, body: RefineProfileRequest):
    """Refine the prompt_text for a sender using an AI instruction."""
    refined = guarded_refine(current_text=body.current_text, instruction=body.instruction)
    return ProfileResponse(email=email, prompt_text=refined)
