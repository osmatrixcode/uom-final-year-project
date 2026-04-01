import logging
import os
import tomllib
import pathlib
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from langchain_core.prompts import ChatPromptTemplate

logger = logging.getLogger(__name__)

_PROMPTS_PATH = pathlib.Path(__file__).parent.parent / "prompts.toml"
with open(_PROMPTS_PATH, "rb") as _f:
    _PROMPTS = tomllib.load(_f)


_EMAIL_HEADER_RE = __import__("re").compile(
    r"^(Subject|To|From|Date|Cc|Bcc):.*\n?", __import__("re").IGNORECASE | __import__("re").MULTILINE
)

def _strip_email_headers(text: str) -> str:
    """Remove any email header lines (Subject:, To:, etc.) the LLM accidentally outputs."""
    return _EMAIL_HEADER_RE.sub("", text).lstrip("\n")


def _build_prompt(prompt_key: str) -> ChatPromptTemplate:
    p = _PROMPTS[prompt_key]
    return ChatPromptTemplate.from_messages([("system", p["system"]), ("human", p["human"])])


# Cache only chat-style prompts (those with system/human keys) at import time
_CHAT_PROMPT_KEYS = {"generate_reply", "refine_draft", "general_qa", "refine_profile_text"}
_PROMPT_CACHE = {key: _build_prompt(key) for key in _CHAT_PROMPT_KEYS}


class LangChainService:
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4o-mini",
            api_key=os.getenv("OPENAI_API_KEY")
        )

    def get_hello(self) -> str:
        response = self.llm.invoke([HumanMessage(content="Say hello in one sentence.")])
        return response.content

    def _build_thread_context(self, graph_thread: dict | None, injected_context: str | None = None) -> str:
        parts = []
        if graph_thread:
            thread_messages = graph_thread.get("thread", [])
            if thread_messages:
                summaries = []
                for msg in thread_messages:
                    sender = msg.get("from", {}).get("emailAddress", {}).get("name", "Unknown")
                    preview = msg.get("bodyPreview", "")
                    date = msg.get("receivedDateTime", "")[:10]
                    summaries.append(f"[{date}] {sender}: {preview}")
                parts.append("\n\nConversation history (from Microsoft Graph):\n" + "\n".join(summaries))
        if injected_context:
            parts.append(injected_context)
        return "".join(parts)

    def generate_profile_text(self, history_preview: str, fallback_body: str, mode: str, name: str = "") -> str:
        """
        Generate a 2-3 sentence tone/style summary.
        mode: "sender" — summarise user's tone when writing to this person
              "thread" — summarise the user's tone within this thread
        Falls back to fallback_body if history_preview is empty.
        Prompt templates are loaded from prompts.toml.
        """
        toml_key = "generate_sender_profile" if mode == "sender" else "generate_thread_note"
        section = _PROMPTS[toml_key]

        if history_preview:
            template = section["with_history"]
            prompt = template.format(
                name=name or "this person",
                history_preview=history_preview,
            )
        else:
            template = section["without_history"]
            prompt = template.format(fallback_body=fallback_body)

        response = self.llm.invoke([HumanMessage(content=prompt)])
        return response.content.strip()

    def refine_profile_text(self, current_text: str, instruction: str) -> str:
        """Refine a sender profile or thread note based on user instruction."""
        chain = _PROMPT_CACHE["refine_profile_text"] | self.llm
        result = chain.invoke({
            "current_text": current_text,
            "instruction": instruction,
        })
        return result.content.strip()

    def generate_email_reply(self, email_context, graph_thread: dict | None = None) -> tuple[str, str]:
        """Returns (reply_text, intent) where intent is 'draft' or 'qa'."""
        recipients_str = ", ".join(
            r.displayName or r.emailAddress for r in email_context.recipients
        ) or "the sender"
        thread_context = self._build_thread_context(graph_thread, getattr(email_context, "injected_context", None))
        instruction = email_context.instruction or ""
        mode = getattr(email_context, "mode", None) or "general_qa"

        if mode == "email_draft":
            instruction_note = f"\nUser instruction: {instruction}\n" if instruction else ""
            if email_context.draft:
                reply = (_PROMPT_CACHE["refine_draft"] | self.llm).invoke({
                    "subject": email_context.subject,
                    "recipients": recipients_str,
                    "body": email_context.body,
                    "thread_context": thread_context,
                    "draft": email_context.draft,
                    "instruction_note": instruction_note,
                }).content
            else:
                reply = (_PROMPT_CACHE["generate_reply"] | self.llm).invoke({
                    "subject": email_context.subject,
                    "recipients": recipients_str,
                    "body": email_context.body,
                    "thread_context": thread_context,
                    "instruction_note": instruction_note,
                }).content
            return reply, "draft"

        elif mode == "sender_edit":
            return "Sender Edit mode is not yet implemented.", "qa"

        else:  # general_qa (default)
            reply = (_PROMPT_CACHE["general_qa"] | self.llm).invoke({
                "subject": email_context.subject,
                "recipients": recipients_str,
                "body": email_context.body,
                "thread_context": thread_context,
                "instruction": instruction,
            }).content
            return reply, "qa"

    def stream_email_reply(self, email_context, graph_thread: dict | None = None, sender_name: str | None = None):
        """Yields reply text chunks for streaming responses."""
        recipients_str = ", ".join(
            r.displayName or r.emailAddress for r in email_context.recipients
        ) or "the sender"
        thread_context = self._build_thread_context(graph_thread, getattr(email_context, "injected_context", None))
        instruction = email_context.instruction or ""
        mode = getattr(email_context, "mode", None) or "general_qa"

        if mode == "email_draft":
            instruction_note = f"\nUser instruction: {instruction}\n" if instruction else ""
            sender = sender_name or ""
            if email_context.draft:
                prompt_key = "refine_draft"
                logger.info("[LangChain] mode=%s | prompt=%s (draft present) | sender=%s", mode, prompt_key, sender or "unknown")
                chain = _PROMPT_CACHE[prompt_key] | self.llm
                invoke_vars = {
                    "subject": email_context.subject,
                    "recipients": recipients_str,
                    "body": email_context.body,
                    "thread_context": thread_context,
                    "draft": email_context.draft,
                    "instruction_note": instruction_note,
                    "sender_name": sender,
                }
            else:
                prompt_key = "generate_reply"
                logger.info("[LangChain] mode=%s | prompt=%s (no draft) | sender=%s", mode, prompt_key, sender or "unknown")
                chain = _PROMPT_CACHE[prompt_key] | self.llm
                invoke_vars = {
                    "subject": email_context.subject,
                    "recipients": recipients_str,
                    "body": email_context.body,
                    "thread_context": thread_context,
                    "instruction_note": instruction_note,
                    "sender_name": sender,
                }
            buffer = ""
            header_stripped = False
            for chunk in chain.stream(invoke_vars):
                if not chunk.content:
                    continue
                if not header_stripped:
                    buffer += chunk.content
                    # Wait until we have enough content to detect headers
                    if "\n" in buffer or len(buffer) > 120:
                        clean = _strip_email_headers(buffer)
                        if clean:
                            yield clean
                        header_stripped = True
                        buffer = ""
                else:
                    yield chunk.content
            # Flush any remaining buffer (short responses with no newline)
            if buffer:
                yield _strip_email_headers(buffer)

        elif mode == "sender_edit":
            logger.info("[LangChain] mode=%s | prompt=none (not implemented)", mode)
            yield "Sender Edit mode is not yet implemented."

        else:  # general_qa (default)
            logger.info("[LangChain] mode=%s | prompt=general_qa", mode)
            chain = _PROMPT_CACHE["general_qa"] | self.llm
            for chunk in chain.stream({
                "subject": email_context.subject,
                "recipients": recipients_str,
                "body": email_context.body,
                "thread_context": thread_context,
                "instruction": instruction,
            }):
                if chunk.content:
                    yield chunk.content
