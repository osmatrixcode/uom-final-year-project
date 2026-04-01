import logging
import os
import tomllib
import pathlib
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from langchain_core.prompts import ChatPromptTemplate
from app.services.prompt_logger import log_prompt_and_response, log_safety_block
from app.services.safety_service import check_safety, SafetyFailure

logger = logging.getLogger(__name__)

_PROMPTS_PATH = pathlib.Path(__file__).parent.parent / "prompts.toml"
with open(_PROMPTS_PATH, "rb") as _f:
    _PROMPTS = tomllib.load(_f)


import re as _re

_EMAIL_HEADER_RE = _re.compile(
    r"^(Subject|To|From|Date|Cc|Bcc):.*\n?", _re.IGNORECASE | _re.MULTILINE
)

# Matches the inline header block that Office.js prepends in reply-compose mode:
# "From: Name <email>Sent: ...To: ...Subject: ...  Body text"
_OFFICEJS_HEADER_PREFIX_RE = _re.compile(
    r"^From:\s.*?Subject:\s*(?:Re:\s*)?[^\s].*?\s{2,}", _re.IGNORECASE | _re.DOTALL
)

def _strip_email_headers(text: str) -> str:
    """Remove any email header lines (Subject:, To:, etc.) the LLM accidentally outputs."""
    return _EMAIL_HEADER_RE.sub("", text).lstrip("\n")


def _strip_officejs_header_prefix(text: str) -> str:
    """Strip the inline header block Office.js prepends in reply-compose bodies."""
    return _OFFICEJS_HEADER_PREFIX_RE.sub("", text).lstrip()


def _build_prompt(prompt_key: str) -> ChatPromptTemplate:
    p = _PROMPTS[prompt_key]
    return ChatPromptTemplate.from_messages([("system", p["system"]), ("human", p["human"])])


# Cache only chat-style prompts (those with system/human keys) at import time
_CHAT_PROMPT_KEYS = {"generate_reply", "refine_draft", "general_qa", "refine_profile_text"}
_PROMPT_CACHE = {key: _build_prompt(key) for key in _CHAT_PROMPT_KEYS}


def _render_prompt(prompt_key: str, variables: dict) -> tuple[str | None, str]:
    """Render a cached ChatPromptTemplate and return (system_text, human_text)."""
    messages = _PROMPT_CACHE[prompt_key].format_messages(**variables)
    system_text = None
    human_text = ""
    for msg in messages:
        if msg.type == "system":
            system_text = msg.content
        elif msg.type == "human":
            human_text = msg.content
    return system_text, human_text


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
                    preview = msg.get("bodyFull") or msg.get("bodyPreview", "")
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
        output = response.content.strip()
        log_prompt_and_response(
            prompt_key=toml_key,
            variables={"name": name, "history_preview": history_preview, "fallback_body": fallback_body, "mode": mode},
            rendered_system=None,
            rendered_human=prompt,
            output=output,
        )
        return output

    def refine_profile_text(self, current_text: str, instruction: str) -> str:
        """Refine a sender profile or thread note based on user instruction."""
        variables = {"current_text": current_text, "instruction": instruction}
        chain = _PROMPT_CACHE["refine_profile_text"] | self.llm
        result = chain.invoke(variables)
        output = result.content.strip()
        sys_text, human_text = _render_prompt("refine_profile_text", variables)
        log_prompt_and_response(
            prompt_key="refine_profile_text",
            variables=variables,
            rendered_system=sys_text,
            rendered_human=human_text,
            output=output,
        )
        return output

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
                prompt_key = "refine_draft"
                variables = {
                    "subject": email_context.subject,
                    "recipients": recipients_str,
                    "body": email_context.body,
                    "thread_context": thread_context,
                    "draft": _strip_officejs_header_prefix(email_context.draft),
                    "instruction_note": instruction_note,
                }
                reply = (_PROMPT_CACHE[prompt_key] | self.llm).invoke(variables).content
            else:
                prompt_key = "generate_reply"
                variables = {
                    "subject": email_context.subject,
                    "recipients": recipients_str,
                    "body": email_context.body,
                    "thread_context": thread_context,
                    "instruction_note": instruction_note,
                }
                reply = (_PROMPT_CACHE[prompt_key] | self.llm).invoke(variables).content
            sys_text, human_text = _render_prompt(prompt_key, variables)
            log_prompt_and_response(
                prompt_key=prompt_key, variables=variables, mode=mode,
                rendered_system=sys_text, rendered_human=human_text, output=reply,
            )
            return reply, "draft"

        elif mode == "sender_edit":
            return "Sender Edit mode is not yet implemented.", "qa"

        else:  # general_qa (default)
            prompt_key = "general_qa"
            variables = {
                "subject": email_context.subject,
                "recipients": recipients_str,
                "body": email_context.body,
                "thread_context": thread_context,
                "instruction": instruction,
            }
            reply = (_PROMPT_CACHE[prompt_key] | self.llm).invoke(variables).content
            sys_text, human_text = _render_prompt(prompt_key, variables)
            log_prompt_and_response(
                prompt_key=prompt_key, variables=variables, mode=mode,
                rendered_system=sys_text, rendered_human=human_text, output=reply,
            )

            # Independent safety classifier
            try:
                check_safety(instruction, reply)
            except SafetyFailure as exc:
                log_safety_block(
                    instruction=instruction, llm_output=reply,
                    reason=exc.reason, mode=mode,
                )
                return ("Your question appears to be outside the scope of this email thread. "
                        "I can only help with questions about this email or email-related tasks."), "qa"

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
                    "draft": _strip_officejs_header_prefix(email_context.draft),
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
            full_output_chunks = []
            for chunk in chain.stream(invoke_vars):
                if not chunk.content:
                    continue
                if not header_stripped:
                    buffer += chunk.content
                    if "\n" in buffer or len(buffer) > 120:
                        clean = _strip_email_headers(buffer)
                        if clean:
                            full_output_chunks.append(clean)
                            yield clean
                        header_stripped = True
                        buffer = ""
                else:
                    full_output_chunks.append(chunk.content)
                    yield chunk.content
            if buffer:
                clean = _strip_email_headers(buffer)
                full_output_chunks.append(clean)
                yield clean
            # Log after streaming completes
            sys_text, human_text = _render_prompt(prompt_key, invoke_vars)
            log_prompt_and_response(
                prompt_key=prompt_key, variables=invoke_vars, mode=mode,
                rendered_system=sys_text, rendered_human=human_text,
                output="".join(full_output_chunks),
            )

        elif mode == "sender_edit":
            logger.info("[LangChain] mode=%s | prompt=none (not implemented)", mode)
            yield "Sender Edit mode is not yet implemented."

        else:  # general_qa (default)
            logger.info("[LangChain] mode=%s | prompt=general_qa", mode)
            prompt_key = "general_qa"
            invoke_vars = {
                "subject": email_context.subject,
                "recipients": recipients_str,
                "body": email_context.body,
                "thread_context": thread_context,
                "instruction": instruction,
            }
            chain = _PROMPT_CACHE[prompt_key] | self.llm

            # Buffer the full response so the safety classifier can evaluate
            # the complete interaction before anything is sent to the client.
            full_output_chunks = []
            for chunk in chain.stream(invoke_vars):
                if chunk.content:
                    full_output_chunks.append(chunk.content)

            full_output = "".join(full_output_chunks)

            # Log the LLM call
            sys_text, human_text = _render_prompt(prompt_key, invoke_vars)
            log_prompt_and_response(
                prompt_key=prompt_key, variables=invoke_vars, mode=mode,
                rendered_system=sys_text, rendered_human=human_text,
                output=full_output,
            )

            # Independent safety classifier — evaluates instruction + output
            try:
                check_safety(instruction, full_output)
            except SafetyFailure as exc:
                log_safety_block(
                    instruction=instruction,
                    llm_output=full_output,
                    reason=exc.reason,
                    mode=mode,
                )
                yield "__SAFETY_BLOCK__"
                return

            # Safe — release the buffered response
            yield full_output
