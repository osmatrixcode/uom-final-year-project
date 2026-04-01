import os
import re
import msal
import requests
from html import unescape
from urllib.parse import quote


def html_to_text(html: str) -> str:
    """Rough HTML-to-plaintext conversion for Graph message bodies."""
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    return unescape(text).strip()

# In-memory token cache (sufficient for dev/testing; replace with DB for production)
_token_cache: dict = {}

SCOPES = ["User.Read", "Mail.Read"]


def _build_msal_app() -> msal.ConfidentialClientApplication:
    return msal.ConfidentialClientApplication(
        client_id=os.environ["MS_CLIENT_ID"],
        client_credential=os.environ["MS_CLIENT_SECRET"],
        # "common" allows both work/school AND personal Microsoft accounts
        authority="https://login.microsoftonline.com/common",
    )


def get_auth_url() -> str:
    app = _build_msal_app()
    return app.get_authorization_request_url(
        scopes=SCOPES,
        redirect_uri=os.environ.get("MS_REDIRECT_URI", "http://localhost:8000/graph/auth/callback"),
    )


def exchange_code_for_token(code: str) -> dict:
    app = _build_msal_app()
    result = app.acquire_token_by_authorization_code(
        code=code,
        scopes=SCOPES,
        redirect_uri=os.environ.get("MS_REDIRECT_URI", "http://localhost:8000/graph/auth/callback"),
    )
    if "access_token" not in result:
        raise RuntimeError(f"Token exchange failed: {result.get('error_description')}")
    _token_cache["token"] = result
    return result


def get_stored_token() -> str:
    token_data = _token_cache.get("token")
    if not token_data:
        raise RuntimeError("Not authenticated. Visit /graph/auth/login first.")

    # Try to refresh silently if expired
    app = _build_msal_app()
    accounts = app.get_accounts()
    if accounts:
        result = app.acquire_token_silent(scopes=SCOPES, account=accounts[0])
        if result and "access_token" in result:
            _token_cache["token"] = result
            return result["access_token"]

    return token_data["access_token"]


def graph_get(url: str) -> dict | list:
    token = get_stored_token()
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    if not response.ok:
        raise RuntimeError(f"Graph API {response.status_code}: {response.text}")
    return response.json()


def graph_get_with_token(url: str, token: str, extra_headers: dict | None = None) -> dict | list:
    """Call Graph API using a token supplied directly (e.g. NAA token from the client)."""
    headers = {"Authorization": f"Bearer {token}"}
    if extra_headers:
        headers.update(extra_headers)
    response = requests.get(url, headers=headers)
    if not response.ok:
        raise RuntimeError(f"Graph API {response.status_code}: {response.text}")
    return response.json()


GRAPH_BASE = "https://graph.microsoft.com/v1.0"


def get_thread_by_conversation_id(conversation_id: str, token: str) -> dict:
    """
    Fetch the conversation thread from Graph using a conversationId.
    conversationId is available in Outlook compose/reply mode even before the draft is saved,
    making this the preferred path when replying to an existing email.
    """
    safe_cid = quote(conversation_id, safe="")
    result = graph_get_with_token(
        f"{GRAPH_BASE}/me/messages"
        f"?$filter=conversationId eq '{safe_cid}'"
        f"&$select=subject,bodyPreview,body,from,receivedDateTime,conversationId,isDraft"
        f"&$top=10",
        token,
    )
    # Filter out drafts client-side — consumer Graph API rejects isDraft in $filter
    sent_messages = [m for m in result.get("value", []) if not m.get("isDraft", False)]
    # Add plaintext body for callers that need the full content
    for m in sent_messages:
        body_obj = m.get("body", {})
        if body_obj.get("contentType") == "html":
            m["bodyFull"] = html_to_text(body_obj.get("content", ""))
        else:
            m["bodyFull"] = body_obj.get("content", "").strip()
    # Sort client-side — Graph rejects $orderby combined with $filter on messages
    thread_messages = sorted(
        sent_messages,
        key=lambda m: m.get("receivedDateTime", ""),
    )
    primary = thread_messages[-1] if thread_messages else {}
    return {"message": primary, "thread": thread_messages}


def get_email_thread(item_rest_id: str, token: str) -> dict:
    """
    Fetch an email and its conversation thread from Graph using the client's NAA token.
    item_rest_id must be a REST-format ID — the client converts it with
    Office.context.mailbox.convertToRestId() before sending.
    """
    message = graph_get_with_token(
        f"{GRAPH_BASE}/me/messages/{item_rest_id}"
        "?$select=id,subject,body,from,toRecipients,receivedDateTime,conversationId",
        token,
    )

    conversation_id = message.get("conversationId", "")
    thread_messages: list = []
    if conversation_id:
        safe_cid = quote(conversation_id, safe="")
        result = graph_get_with_token(
            f"{GRAPH_BASE}/me/messages"
            f"?$filter=conversationId eq '{safe_cid}'"
            f"&$select=subject,bodyPreview,from,receivedDateTime,isDraft"
            f"&$top=10",
            token,
        )
        thread_messages = sorted(
            [m for m in result.get("value", []) if not m.get("isDraft", False)],
            key=lambda m: m.get("receivedDateTime", ""),
        )

    return {"message": message, "thread": thread_messages}
