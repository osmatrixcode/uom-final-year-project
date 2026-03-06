import os
import tomllib
import pathlib
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from langchain_core.prompts import ChatPromptTemplate

_PROMPTS_PATH = pathlib.Path(__file__).parent.parent / "prompts.toml"
with open(_PROMPTS_PATH, "rb") as _f:
    _PROMPTS = tomllib.load(_f)


def _build_prompt(prompt_key: str) -> ChatPromptTemplate:
    p = _PROMPTS[prompt_key]
    return ChatPromptTemplate.from_messages([("system", p["system"]), ("human", p["human"])])


# Cache all prompts at import time — avoids rebuilding on every request
_PROMPT_CACHE = {key: _build_prompt(key) for key in _PROMPTS}


class LangChainService:
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4o-mini",
            api_key=os.getenv("OPENAI_API_KEY")
        )

    def get_hello(self) -> str:
        response = self.llm.invoke([HumanMessage(content="Say hello in one sentence.")])
        return response.content

    def _classify_intent(self, instruction: str) -> str:
        """Returns 'draft' or 'qa' based on the user's instruction."""
        result = (_PROMPT_CACHE["intent_classifier"] | self.llm).invoke({"instruction": instruction}).content.strip().lower()
        return "qa" if result.startswith("qa") else "draft"

    def generate_email_reply(self, email_context, graph_thread: dict | None = None) -> tuple[str, str]:
        """Returns (reply_text, intent) where intent is 'draft' or 'qa'."""
        recipients_str = ", ".join(
            r.displayName or r.emailAddress for r in email_context.recipients
        ) or "the sender"

        # Build a richer thread summary when Graph data is available
        thread_context = ""
        if graph_thread:
            thread_messages = graph_thread.get("thread", [])
            if thread_messages:
                summaries = []
                for msg in thread_messages:
                    sender = msg.get("from", {}).get("emailAddress", {}).get("name", "Unknown")
                    preview = msg.get("bodyPreview", "")
                    date = msg.get("receivedDateTime", "")[:10]
                    summaries.append(f"[{date}] {sender}: {preview}")
                thread_context = "\n\nConversation history (from Microsoft Graph):\n" + "\n".join(summaries)

        instruction = email_context.instruction or ""

        # Classify intent only when the user typed something
        intent = self._classify_intent(instruction) if instruction else "draft"

        if intent == "qa":
            reply = (_PROMPT_CACHE["general_qa"] | self.llm).invoke({
                "subject": email_context.subject,
                "recipients": recipients_str,
                "body": email_context.body,
                "thread_context": thread_context,
                "instruction": instruction,
            }).content
        else:
            instruction_note = f"User instruction: {instruction}" if instruction else ""
            prompt_key = "refine_draft" if email_context.draft else "generate_reply"
            reply = (_PROMPT_CACHE[prompt_key] | self.llm).invoke({
                "subject": email_context.subject,
                "recipients": recipients_str,
                "body": email_context.body,
                "thread_context": thread_context,
                "instruction_note": instruction_note,
                "draft": email_context.draft or "",
            }).content

        return reply, intent
