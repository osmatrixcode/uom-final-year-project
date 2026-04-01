"""
LLM Guard input scanners — detects prompt injection and invisible-text
attacks BEFORE the user input reaches the LLM.

Scanners are initialised once at module level (PromptInjection loads an
ML model on first import).
"""

import logging

from llm_guard.input_scanners import InvisibleText, PromptInjection

logger = logging.getLogger(__name__)

# Initialised once at module level — PromptInjection downloads/loads
# its ML model here (~200 MB on first run, cached afterwards).
_invisible_text_scanner = InvisibleText()
_injection_scanner = PromptInjection(threshold=0.92)


class InjectionFailure(Exception):
    """Raised when user input is flagged as a prompt injection attempt."""

    def __init__(self, scanner_name: str, risk_score: float):
        self.scanner_name = scanner_name
        self.risk_score = risk_score
        super().__init__(
            f"Input flagged by {scanner_name} (risk={risk_score:.2f})"
        )


def check_injection(text: str) -> None:
    """
    Run *text* through LLM Guard input scanners.

    Raises ``InjectionFailure`` if any scanner flags the input.
    Does nothing (returns ``None``) when the text is safe.
    Logs a warning and silently passes if the scanner itself fails,
    so an LLM Guard error never blocks the user.
    """
    if not text or not text.strip():
        return

    try:
        # 1. Invisible text check (fast, no ML)
        _sanitized, is_valid, risk_score = _invisible_text_scanner.scan(text)
        if not is_valid:
            logger.info("InvisibleText scanner flagged input: risk=%.4f", risk_score)
            raise InjectionFailure("InvisibleText", risk_score)

        # 2. Prompt injection check (ML model)
        _sanitized, is_valid, risk_score = _injection_scanner.scan(text)
        if not is_valid:
            logger.info("PromptInjection scanner flagged input: risk=%.4f", risk_score)
            raise InjectionFailure("PromptInjection", risk_score)
    except InjectionFailure:
        raise
    except Exception:
        logger.warning("LLM Guard scanner failed — allowing request", exc_info=True)
        return
