"""
OpenAI Moderation API guard — checks user-supplied text BEFORE it reaches
prompt templates or the LLM.

The moderation endpoint is free and adds ~100-300 ms latency.
Docs: https://platform.openai.com/docs/guides/moderation
"""

import logging
import os

from openai import OpenAI

logger = logging.getLogger(__name__)

_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class ModerationFailure(Exception):
    """Raised when user input is flagged by the moderation API."""

    def __init__(self, categories: list[str]):
        self.categories = categories
        super().__init__(f"Input flagged for: {', '.join(categories)}")


def check_moderation(text: str) -> None:
    """
    Send *text* to the OpenAI Moderation API.

    Raises ``ModerationFailure`` if any category is flagged.
    Does nothing (returns ``None``) when the text is safe.
    Logs a warning and silently passes if the API call itself fails,
    so a moderation outage never blocks the user.
    """
    if not text or not text.strip():
        return

    try:
        response = _client.moderations.create(
            model="omni-moderation-latest",
            input=text,
        )
    except Exception:
        logger.warning("Moderation API call failed — allowing request", exc_info=True)
        return

    result = response.results[0]
    if result.flagged:
        flagged = [cat for cat, hit in result.categories.model_dump().items() if hit]
        logger.info("Moderation flagged input: categories=%s", flagged)
        raise ModerationFailure(flagged)
