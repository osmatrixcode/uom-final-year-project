import logging
import requests

logger = logging.getLogger(__name__)

GRAPH_ME_URL = "https://graph.microsoft.com/v1.0/me"


class TokenValidationError(Exception):
    pass


class ValidatedToken:
    def __init__(self, claims: dict):
        self.user_id: str = claims.get("id", claims.get("oid", ""))
        self.email: str = claims.get("mail", claims.get("userPrincipalName", ""))
        self.name: str = claims.get("displayName", "")
        self.claims = claims


def validate_token_via_graph(token: str) -> ValidatedToken:
    """
    Validates a token by calling Graph /me with it.
    Works for both JWT and opaque (compact) tokens — NAA in Outlook returns
    opaque tokens for Graph scopes, so JWT decoding is not reliable here.
    """
    response = requests.get(
        GRAPH_ME_URL,
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )
    if response.status_code == 401:
        raise TokenValidationError("Token rejected by Graph API (401 Unauthorized).")
    if not response.ok:
        raise TokenValidationError(f"Graph /me returned {response.status_code}.")
    return ValidatedToken(response.json())


def try_validate_token(token: str | None) -> ValidatedToken | None:
    """
    Validates a token if provided. Returns None if no token is given or validation fails.
    Uses Graph /me as the validation mechanism so it works with both JWT and opaque tokens.
    """
    if not token:
        return None
    try:
        return validate_token_via_graph(token)
    except TokenValidationError as e:
        logger.warning("Token validation failed: %s", e)
        return None
    except Exception as e:
        logger.warning("Unexpected error during token validation: %s", e)
        return None
