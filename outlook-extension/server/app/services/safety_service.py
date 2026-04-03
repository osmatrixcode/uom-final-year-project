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
    _ALL_PROMPTS = tomllib.load(_f)

_SAFETY_PROMPTS = {
    "general_qa": _ALL_PROMPTS["safety_classifier"]["system"],
    "sender_edit": _ALL_PROMPTS["sender_edit_safety_classifier"]["system"],
    "email_draft": _ALL_PROMPTS["email_draft_safety_classifier"]["system"],
}


class SafetyFailure(Exception):
    """Raised when the safety classifier flags an interaction as out-of-scope."""

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(f"Out-of-scope interaction: {reason}")


def check_safety(instruction: str, llm_output: str, classifier_key: str = "general_qa") -> None:
    """
    Send the instruction + LLM output to the safety classifier.

    *classifier_key* selects which system prompt to use:
    ``"general_qa"`` for email Q&A scope, ``"sender_edit"`` for
    tone/style description scope.

    Raises ``SafetyFailure`` if the interaction is out-of-scope.
    Does nothing (returns ``None``) when the interaction is safe.
    Logs a warning and silently passes if the API call itself fails.
    """
    if not instruction or not instruction.strip():
        return

    system_prompt = _SAFETY_PROMPTS.get(classifier_key, _SAFETY_PROMPTS["general_qa"])

    try:
        response = _client.chat.completions.create(
            model="gpt-5.4-mini-2026-03-17",
            temperature=0,
            max_tokens=50,
            messages=[
                {"role": "system", "content": system_prompt},
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
