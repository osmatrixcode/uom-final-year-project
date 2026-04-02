"""
Independent safeguarding model — evaluates the user instruction + LLM output
AFTER generation but BEFORE the response is returned to the client.

Uses GPT-4o-mini as a lightweight classifier (independent from the main LLM call).
This is the "Llama Guard" pattern adapted to use an OpenAI model.
"""

import logging
import os
import pathlib
import tomllib

from openai import OpenAI

logger = logging.getLogger(__name__)

_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

_PROMPTS_PATH = pathlib.Path(__file__).parent.parent / "prompts.toml"
with open(_PROMPTS_PATH, "rb") as _f:
    _SAFETY_SYSTEM_PROMPT = tomllib.load(_f)["safety_classifier"]["system"]


class SafetyFailure(Exception):
    """Raised when the safety classifier flags an interaction as out-of-scope."""

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(f"Out-of-scope interaction: {reason}")


def check_safety(instruction: str, llm_output: str) -> None:
    """
    Send the instruction + LLM output to the safety classifier.

    Raises ``SafetyFailure`` if the interaction is out-of-scope.
    Does nothing (returns ``None``) when the interaction is safe.
    Logs a warning and silently passes if the API call itself fails.
    """
    if not instruction or not instruction.strip():
        return

    try:
        response = _client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,
            max_tokens=50,
            messages=[
                {"role": "system", "content": _SAFETY_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"User instruction: {instruction}\n\n"
                        f"Assistant response: {llm_output}"
                    ),
                },
            ],
        )
    except Exception:
        logger.warning("Safety classifier call failed — allowing response", exc_info=True)
        return

    verdict = response.choices[0].message.content.strip().lower()
    logger.info("Safety verdict: %s", verdict)

    if verdict.startswith("unsafe"):
        reason = verdict.removeprefix("unsafe:").strip() or "out-of-scope"
        raise SafetyFailure(reason)
