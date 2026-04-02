"""
Security & privacy pipeline for sender_edit mode.

Wraps the generate and refine LLM calls with the same linear guard
pattern used by general_qa:

    INPUT GUARDS → MODEL → OUTPUT GUARDS → DEANONYMIZE

Two public functions:
    guarded_generate()  — for profile/thread auto-fill endpoints
    guarded_refine()    — for profile/thread refinement endpoints
"""

import logging
import re

from fastapi import HTTPException

from app.services.anonymize_service import (
    create_anonymizer,
    anonymize_text,
    deanonymize_text,
)
from app.services.injection_service import (
    check_injection,
    check_body_injection,
    InjectionFailure,
)
from app.services.moderation_service import check_moderation, ModerationFailure
from app.services.safety_service import check_safety, SafetyFailure
from app.services.prompt_logger import (
    log_anonymization,
    log_prompt_and_response,
    log_injection_block,
    log_moderation_block,
    log_safety_block,
)
from app.services.langchain_service import LangChainService

logger = logging.getLogger(__name__)

_SCOPE_FALLBACK = (
    "The AI-generated text didn't match the expected format (tone/style description). "
    "Please try again or write the profile manually."
)


def guarded_save(text: str, identifier: str = "") -> str:
    """Guard text before persisting to SQLite.

    Pipeline:
        1. PII anonymize (for checks only — moderation API is external)
        2. Injection check (invisible text + ML: hard block)
        3. Moderation check (on anonymized text)
        4. Log anonymization + original text views
        5. Return original text unchanged

    Raises HTTPException(422) if injection or moderation flags the text.
    """
    if not text or not text.strip():
        return text

    _vault, anon_scanner, _deanon = create_anonymizer()
    anon_text = anonymize_text(text, anon_scanner)

    try:
        check_injection(anon_text)
    except InjectionFailure as exc:
        log_injection_block(instruction=anon_text, scanner_name=exc.scanner_name, risk_score=exc.risk_score, mode="sender_edit_save")
        raise HTTPException(status_code=422, detail="Your text was flagged by our security filter. Please revise.")

    try:
        check_moderation(anon_text)
    except ModerationFailure as exc:
        log_moderation_block(instruction=anon_text, categories=exc.categories, mode="sender_edit_save")
        raise HTTPException(status_code=422, detail=f"Your text was flagged by our content policy ({', '.join(exc.categories)}). Please revise.")

    # Log: anonymization view (what the checks saw)
    log_anonymization(prompt_after=anon_text, output_before="[manual save — no LLM output]", mode="sender_edit_save")

    # Log: original text view (what was actually saved)
    log_prompt_and_response(
        prompt_key="manual_save", mode="sender_edit_save",
        variables={"identifier": identifier},
        rendered_system=None,
        rendered_human=text,
        output=text,
    )

    return text

# Regex to extract sender names from history_preview bracket headers
# e.g. "[2026-04-01] John Smith: Hi there..."
_SENDER_NAME_RE = re.compile(r"^\[[\d-]+\]\s+(.+?):", re.MULTILINE)


def _extract_names_from_history(history_preview: str) -> list[str]:
    """Pull sender names from '[date] Name: ...' lines in history_preview."""
    names: list[str] = []
    for match in _SENDER_NAME_RE.finditer(history_preview):
        full_name = match.group(1).strip()
        if full_name and full_name != "Unknown":
            names.append(full_name)
            for part in full_name.split():
                if len(part) > 1:
                    names.append(part)
    return names


def _extract_names_from_email(email: str) -> list[str]:
    """Pull name-like parts from an email address (e.g. john.smith@co.com → [john, smith])."""
    local = email.split("@")[0] if "@" in email else email
    parts = re.split(r"[._\-+]", local)
    return [p for p in parts if len(p) > 1 and p.isalpha()]


def guarded_generate(
    history_preview: str,
    fallback_body: str,
    mode: str,
    name: str = "",
) -> str:
    """Full security pipeline for profile/thread auto-fill.

    Pipeline:
        1. PII anonymize (history_preview, fallback_body, name)
        2. Body injection check on history_preview
        2b. Body injection check on fallback_body
        3. LLM call
        4. Scope classifier (sender_edit)
        5. Output injection check
        6. Output moderation
        7. Deanonymize → log → return
    """
    prompt_key = "generate_sender_profile" if mode == "sender" else "generate_thread_note"

    # ── INPUT GUARDS ──

    # 1. PII anonymize
    hidden_names = _extract_names_from_history(history_preview)
    if name:
        hidden_names.extend(_extract_names_from_email(name))
    _vault, anon_scanner, deanon_scanner = create_anonymizer(hidden_names=hidden_names)

    orig_history = history_preview
    orig_fallback = fallback_body
    orig_name = name

    history_preview = anonymize_text(history_preview, anon_scanner)
    fallback_body = anonymize_text(fallback_body, anon_scanner)
    name = anonymize_text(name, anon_scanner)

    anon_input = f"name: {name}\nhistory_preview: {history_preview}\nfallback_body: {fallback_body}"

    # 2. Body injection check — only scan the text the LLM will actually use
    #    (history_preview takes priority; fallback_body only used when history is empty)
    body_to_check = history_preview if history_preview.strip() else fallback_body
    try:
        check_body_injection(body_to_check)
    except InjectionFailure as exc:
        log_injection_block(instruction="[email body]", scanner_name=exc.scanner_name, risk_score=exc.risk_score, mode="sender_edit")
        raise HTTPException(status_code=422, detail="The email content contains suspicious hidden text.")

    # ── MODEL ──

    # 3. LLM call
    service = LangChainService()
    anon_output = service.generate_profile_text(
        history_preview=history_preview,
        fallback_body=fallback_body,
        mode=mode,
        name=name,
        skip_logging=True,
    )

    # ── OUTPUT GUARDS ──

    # 4. Scope classifier — verify output is a tone/style description
    try:
        check_safety(anon_input, anon_output, classifier_key="sender_edit")
    except SafetyFailure as exc:
        log_safety_block(instruction=anon_input, llm_output=anon_output, reason=exc.reason, mode="sender_edit")
        raise HTTPException(status_code=422, detail=_SCOPE_FALLBACK)

    # 5. Output injection check
    try:
        check_injection(anon_output)
    except InjectionFailure as exc:
        log_injection_block(instruction=anon_output, scanner_name=exc.scanner_name, risk_score=exc.risk_score, mode="sender_edit")
        raise HTTPException(status_code=422, detail="The generated text was flagged by our security filter.")

    # 6. Output moderation
    try:
        check_moderation(anon_output)
    except ModerationFailure as exc:
        log_moderation_block(instruction=anon_output, categories=exc.categories, mode="sender_edit")
        raise HTTPException(status_code=422, detail=f"The generated text was flagged by our content policy ({', '.join(exc.categories)}).")

    # ── RETURN ──

    # 7. Deanonymize
    output = deanonymize_text(anon_input, anon_output, deanon_scanner)

    # Log: anonymization view + real-world view
    log_anonymization(prompt_after=anon_input, output_before=anon_output, mode="sender_edit")
    log_prompt_and_response(
        prompt_key=prompt_key, mode="sender_edit",
        variables={"name": orig_name, "history_preview": orig_history, "fallback_body": orig_fallback, "mode": mode},
        rendered_system=None,
        rendered_human=f"name: {orig_name}\nhistory_preview: {orig_history}\nfallback_body: {orig_fallback}",
        output=output,
    )

    return output


def guarded_refine(
    current_text: str,
    instruction: str,
) -> str:
    """Full security pipeline for profile/thread refinement.

    Pipeline:
        1. PII anonymize (current_text, instruction)
        2. Injection check on instruction (hard block)
        3. Moderation check on instruction
        4. LLM call
        5. Scope classifier (sender_edit)
        6. Output injection check
        7. Output moderation
        8. Deanonymize → log → return
    """
    # ── INPUT GUARDS ──

    # 1. PII anonymize (no explicit hidden_names — rely on NER for short profile text)
    _vault, anon_scanner, deanon_scanner = create_anonymizer()

    orig_text = current_text
    orig_instruction = instruction

    current_text = anonymize_text(current_text, anon_scanner)
    instruction = anonymize_text(instruction, anon_scanner)

    anon_input = f"current_text: {current_text}\ninstruction: {instruction}"

    # 2. Injection check on instruction (user-authored free-form text)
    try:
        check_injection(instruction)
    except InjectionFailure as exc:
        log_injection_block(instruction=instruction, scanner_name=exc.scanner_name, risk_score=exc.risk_score, mode="sender_edit")
        raise HTTPException(status_code=422, detail="Your instruction was flagged by our security filter. Please rephrase.")

    # 3. Moderation check on instruction
    try:
        check_moderation(instruction)
    except ModerationFailure as exc:
        log_moderation_block(instruction=instruction, categories=exc.categories, mode="sender_edit")
        raise HTTPException(status_code=422, detail=f"Your instruction was flagged by our content policy ({', '.join(exc.categories)}). Please rephrase.")

    # ── MODEL ──

    # 4. LLM call
    service = LangChainService()
    anon_output = service.refine_profile_text(
        current_text=current_text,
        instruction=instruction,
        skip_logging=True,
    )

    # ── OUTPUT GUARDS ──

    # 5. Scope classifier — verify output is a tone/style description
    try:
        check_safety(anon_input, anon_output, classifier_key="sender_edit")
    except SafetyFailure as exc:
        log_safety_block(instruction=anon_input, llm_output=anon_output, reason=exc.reason, mode="sender_edit")
        raise HTTPException(status_code=422, detail=_SCOPE_FALLBACK)

    # 6. Output injection check
    try:
        check_injection(anon_output)
    except InjectionFailure as exc:
        log_injection_block(instruction=anon_output, scanner_name=exc.scanner_name, risk_score=exc.risk_score, mode="sender_edit")
        raise HTTPException(status_code=422, detail="The generated text was flagged by our security filter.")

    # 7. Output moderation
    try:
        check_moderation(anon_output)
    except ModerationFailure as exc:
        log_moderation_block(instruction=anon_output, categories=exc.categories, mode="sender_edit")
        raise HTTPException(status_code=422, detail=f"The generated text was flagged by our content policy ({', '.join(exc.categories)}).")

    # ── RETURN ──

    # 8. Deanonymize
    output = deanonymize_text(anon_input, anon_output, deanon_scanner)

    # Log: anonymization view + real-world view
    log_anonymization(prompt_after=anon_input, output_before=anon_output, mode="sender_edit")
    log_prompt_and_response(
        prompt_key="refine_profile_text", mode="sender_edit",
        variables={"current_text": orig_text, "instruction": orig_instruction},
        rendered_system=None,
        rendered_human=f"current_text: {orig_text}\ninstruction: {orig_instruction}",
        output=output,
    )

    return output
