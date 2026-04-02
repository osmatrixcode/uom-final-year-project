"""
PII anonymization / deanonymization using LLM Guard.

Creates a fresh Vault per request so entity mappings are isolated and
thread-safe.  The Anonymize scanner replaces PII with placeholders
(e.g. [PERSON_1], [EMAIL_ADDRESS_1]) and the Deanonymize scanner
reverses the mapping on the LLM output.
"""

import logging

from llm_guard.input_scanners import Anonymize
from llm_guard.output_scanners import Deanonymize
from llm_guard.vault import Vault

logger = logging.getLogger(__name__)

# Entity types relevant to an email assistant
_ENTITY_TYPES = [
    "PERSON",
    "EMAIL_ADDRESS",
    "PHONE_NUMBER",
    "CREDIT_CARD",
    "IP_ADDRESS",
    "IBAN_CODE",
    "US_SSN",
    "URL",
]


def create_anonymizer(
    hidden_names: list[str] | None = None,
) -> tuple[Vault, Anonymize, Deanonymize]:
    """Return a fresh (vault, anonymize_scanner, deanonymize_scanner) triple.

    *hidden_names* — names that MUST be redacted regardless of NER
    confidence (e.g. recipient display names extracted from the email
    context).  This guarantees consistent replacement even for single
    first names that Presidio's NER might miss.
    """
    vault = Vault()
    anon = Anonymize(
        vault=vault,
        entity_types=_ENTITY_TYPES,
        hidden_names=hidden_names or [],
        preamble="",
        language="en",
    )
    deanon = Deanonymize(vault=vault)
    return vault, anon, deanon


def anonymize_text(text: str, scanner: Anonymize) -> str:
    """Anonymize *text* and return the sanitized version.

    Returns the original text unchanged if anonymization fails.
    """
    if not text or not text.strip():
        return text
    try:
        sanitized, _is_valid, _risk = scanner.scan(text)
        return sanitized
    except Exception:
        logger.warning("Anonymize scanner failed - returning original text", exc_info=True)
        return text


def deanonymize_text(
    anonymized_prompt: str,
    model_output: str,
    scanner: Deanonymize,
) -> str:
    """Replace placeholders in *model_output* with original values.

    Applies a post-processing pass to strip leading/trailing whitespace
    that the NER scanner may have captured as part of entity spans
    (e.g. ``\\nNoah`` stored in the Vault instead of ``Noah``).

    Returns the original model_output unchanged if deanonymization fails.
    """
    if not model_output or not model_output.strip():
        return model_output
    try:
        restored, _is_valid, _risk = scanner.scan(anonymized_prompt, model_output)
        # Clean up stray newlines injected by deanonymization when NER
        # captured leading whitespace as part of an entity span.
        restored = restored.replace(" \n", " ")
        return restored
    except Exception:
        logger.warning("Deanonymize scanner failed - returning original output", exc_info=True)
        return model_output
