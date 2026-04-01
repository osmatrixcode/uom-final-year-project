"""
Logs every LLM call to a text file: resolved prompt + variables + output.
Output dir: server/llm_logs/
"""

import pathlib
import datetime

_LOG_DIR = pathlib.Path(__file__).resolve().parent.parent.parent / "llm_logs"
_LOG_DIR.mkdir(exist_ok=True)


def _separator(label: str) -> str:
    return f"\n{'='*60}\n  {label}\n{'='*60}\n"


def log_prompt_and_response(
    *,
    prompt_key: str,
    variables: dict,
    rendered_system: str | None,
    rendered_human: str,
    output: str,
    mode: str | None = None,
):
    """Write one log entry per LLM call."""
    ts = datetime.datetime.now()
    filename = f"{ts:%Y-%m-%d_%H-%M-%S}_{prompt_key}.txt"
    path = _LOG_DIR / filename

    lines = []
    lines.append(f"Timestamp : {ts.isoformat()}")
    lines.append(f"Prompt key: {prompt_key}")
    if mode:
        lines.append(f"Mode      : {mode}")

    # ── Variables ──
    lines.append(_separator("TEMPLATE VARIABLES"))
    for k, v in variables.items():
        val_str = str(v)
        if len(val_str) > 300:
            val_str = val_str[:300] + f"  ... ({len(str(v))} chars total)"
        lines.append(f"  {k} = {val_str}")

    # ── Rendered prompt ──
    if rendered_system:
        lines.append(_separator("RENDERED SYSTEM PROMPT"))
        lines.append(rendered_system)

    lines.append(_separator("RENDERED HUMAN PROMPT"))
    lines.append(rendered_human)

    # ── LLM output ──
    lines.append(_separator("LLM OUTPUT"))
    lines.append(output)

    lines.append(f"\n{'='*60}\n  END\n{'='*60}\n")

    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def log_moderation_block(
    *,
    instruction: str,
    categories: list[str],
    mode: str | None = None,
):
    """Write a log entry when the moderation API blocks a request."""
    ts = datetime.datetime.now()
    filename = f"{ts:%Y-%m-%d_%H-%M-%S}_moderation_block.txt"
    path = _LOG_DIR / filename

    lines = []
    lines.append(f"Timestamp : {ts.isoformat()}")
    lines.append(f"Event     : MODERATION BLOCK")
    if mode:
        lines.append(f"Mode      : {mode}")

    lines.append(_separator("USER INSTRUCTION"))
    lines.append(f"  {instruction}")

    lines.append(_separator("FLAGGED CATEGORIES"))
    for cat in categories:
        lines.append(f"  - {cat}")

    lines.append(f"\n{'='*60}\n  END\n{'='*60}\n")

    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def log_safety_block(
    *,
    instruction: str,
    llm_output: str,
    reason: str,
    mode: str | None = None,
):
    """Write a log entry when the safety classifier blocks an interaction."""
    ts = datetime.datetime.now()
    filename = f"{ts:%Y-%m-%d_%H-%M-%S}_safety_block.txt"
    path = _LOG_DIR / filename

    lines = []
    lines.append(f"Timestamp : {ts.isoformat()}")
    lines.append(f"Event     : SAFETY BLOCK (independent classifier)")
    if mode:
        lines.append(f"Mode      : {mode}")

    lines.append(_separator("USER INSTRUCTION"))
    lines.append(f"  {instruction}")

    lines.append(_separator("LLM OUTPUT (blocked)"))
    lines.append(llm_output)

    lines.append(_separator("SAFETY VERDICT"))
    lines.append(f"  {reason}")

    lines.append(f"\n{'='*60}\n  END\n{'='*60}\n")

    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def log_injection_block(
    *,
    instruction: str,
    scanner_name: str,
    risk_score: float,
    mode: str | None = None,
):
    """Write a log entry when an LLM Guard scanner blocks a request."""
    ts = datetime.datetime.now()
    filename = f"{ts:%Y-%m-%d_%H-%M-%S}_injection_block.txt"
    path = _LOG_DIR / filename

    lines = []
    lines.append(f"Timestamp : {ts.isoformat()}")
    lines.append(f"Event     : INJECTION BLOCK (LLM Guard)")
    if mode:
        lines.append(f"Mode      : {mode}")

    lines.append(_separator("USER INSTRUCTION"))
    lines.append(f"  {instruction}")

    lines.append(_separator("SCANNER DETAILS"))
    lines.append(f"  Scanner   : {scanner_name}")
    lines.append(f"  Risk score: {risk_score:.4f}")

    lines.append(f"\n{'='*60}\n  END\n{'='*60}\n")

    path.write_text("\n".join(lines), encoding="utf-8")
    return path
