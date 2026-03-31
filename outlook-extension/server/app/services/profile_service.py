import sqlite3
import os
import logging

logger = logging.getLogger(__name__)

_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "profiles.db")
_DB_PATH = os.path.abspath(_DB_PATH)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS profiles (
            email TEXT PRIMARY KEY,
            prompt_text TEXT NOT NULL DEFAULT ''
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS thread_notes (
            conversation_id TEXT PRIMARY KEY,
            note_text TEXT NOT NULL DEFAULT ''
        )
        """
    )
    conn.commit()
    return conn


def _normalise(email: str) -> str:
    return email.strip().lower()


def get_profile(email: str) -> str:
    """Return the stored prompt_text for the given email, or '' if none."""
    try:
        with _connect() as conn:
            row = conn.execute(
                "SELECT prompt_text FROM profiles WHERE email = ?",
                (_normalise(email),),
            ).fetchone()
            return row[0] if row else ""
    except Exception:
        logger.exception("profile_service.get_profile failed for %s", email)
        return ""


def save_profile(email: str, text: str) -> None:
    """Upsert the prompt_text for the given email."""
    try:
        with _connect() as conn:
            conn.execute(
                "INSERT INTO profiles (email, prompt_text) VALUES (?, ?) "
                "ON CONFLICT(email) DO UPDATE SET prompt_text = excluded.prompt_text",
                (_normalise(email), text),
            )
            conn.commit()
    except Exception:
        logger.exception("profile_service.save_profile failed for %s", email)


def delete_profile(email: str) -> None:
    """Remove the profile row for the given email."""
    try:
        with _connect() as conn:
            conn.execute(
                "DELETE FROM profiles WHERE email = ?", (_normalise(email),)
            )
            conn.commit()
    except Exception:
        logger.exception("profile_service.delete_profile failed for %s", email)


# ── Thread notes ──────────────────────────────────────────────────────────────

def get_thread_note(conversation_id: str) -> str:
    """Return the stored note_text for the given conversation_id, or '' if none."""
    try:
        with _connect() as conn:
            row = conn.execute(
                "SELECT note_text FROM thread_notes WHERE conversation_id = ?",
                (conversation_id.strip(),),
            ).fetchone()
            return row[0] if row else ""
    except Exception:
        logger.exception("profile_service.get_thread_note failed for %s", conversation_id)
        return ""


def save_thread_note(conversation_id: str, text: str) -> None:
    """Upsert the note_text for the given conversation_id."""
    try:
        with _connect() as conn:
            conn.execute(
                "INSERT INTO thread_notes (conversation_id, note_text) VALUES (?, ?) "
                "ON CONFLICT(conversation_id) DO UPDATE SET note_text = excluded.note_text",
                (conversation_id.strip(), text),
            )
            conn.commit()
    except Exception:
        logger.exception("profile_service.save_thread_note failed for %s", conversation_id)
