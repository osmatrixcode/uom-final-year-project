import os
import tomllib
import pathlib
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from langchain_core.prompts import ChatPromptTemplate

_PROMPTS_PATH = pathlib.Path(__file__).parent.parent / "prompts.toml"
with open(_PROMPTS_PATH, "rb") as _f:
    _PROMPTS = tomllib.load(_f)


class LangChainService:
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4o-mini",
            api_key=os.getenv("OPENAI_API_KEY")
        )

    def get_hello(self) -> str:
        response = self.llm.invoke([HumanMessage(content="Say hello in one sentence.")])
        return response.content

    def generate_email_reply(self, email_context, graph_thread: dict | None = None) -> str:
        recipients_str = ", ".join(
            r.displayName or r.emailAddress for r in email_context.recipients
        ) or "the sender"

        instruction_note = (
            f"User instruction: {email_context.instruction}" if email_context.instruction else ""
        )

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

        prompt_key = "refine_draft" if email_context.draft else "generate_reply"
        p = _PROMPTS[prompt_key]

        prompt = ChatPromptTemplate.from_messages([
            ("system", p["system"]),
            ("human", p["human"]),
        ])

        chain = prompt | self.llm
        return chain.invoke({
            "subject": email_context.subject,
            "recipients": recipients_str,
            "body": email_context.body,
            "thread_context": thread_context,
            "instruction_note": instruction_note,
            "draft": email_context.draft or "",
        }).content
