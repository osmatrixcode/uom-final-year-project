from fastapi import APIRouter
from fastapi.responses import RedirectResponse
from app.services.graph_service import get_auth_url, exchange_code_for_token, graph_get

router = APIRouter(prefix="/graph", tags=["graph"])

GRAPH = "https://graph.microsoft.com/v1.0"


# --- OAuth Flow ---

@router.get("/auth/login")
def login():
    """Step 1: Redirect user to Microsoft login page."""
    return RedirectResponse(get_auth_url())


@router.get("/auth/callback")
def auth_callback(code: str):
    """Step 2: Microsoft redirects here with a code. Exchange it for tokens."""
    exchange_code_for_token(code)
    return {"message": "Authenticated successfully. You can now call /graph/me or /graph/me/messages"}


# --- Graph API Endpoints ---

@router.get("/me")
def get_me():
    """Get the logged-in user's profile."""
    return graph_get(f"{GRAPH}/me")


@router.get("/me/messages")
def get_messages(top: int = 10):
    """Get the logged-in user's emails (most recent first)."""
    return graph_get(f"{GRAPH}/me/messages?$top={top}&$orderby=receivedDateTime desc&$select=subject,from,receivedDateTime,bodyPreview")
