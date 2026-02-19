import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate


class LangChainService:
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4o-mini",
            api_key=os.getenv("OPENAI_API_KEY")
        )

    def get_hello(self) -> str:
        response = self.llm.invoke([HumanMessage(content="Say hello in one sentence.")])
        return response.content

    def generate_email_reply(self, email_context) -> str:
        recipients_str = ", ".join(
            r.displayName or r.emailAddress for r in email_context.recipients
        ) or "the sender"

        instruction_note = (
            f"\nUser instruction: {email_context.instruction}" if email_context.instruction else ""
        )

        if email_context.draft:
            system_content = (
                "You are a professional email assistant. "
                "The user has written a draft reply and wants you to refine it. "
                "Preserve their intent and edits — improve clarity, tone, and professionalism where needed. "
                "If a user instruction is provided, follow it precisely. "
                "Write only the reply body — no subject line, no greeting preamble, no sign-off."
            )
            human_content = (
                f"Subject: {email_context.subject}\n"
                f"Recipients: {recipients_str}\n\n"
                f"Email thread:\n{email_context.body}\n\n"
                f"User's current draft:\n{email_context.draft}\n"
                f"{instruction_note}\n"
                f"Refine this draft."
            )
        else:
            system_content = (
                "You are a professional email assistant. "
                "Draft a clear, concise, professional reply to the email thread. "
                "Write only the reply body — no subject line, no greeting preamble, no sign-off. "
                "Match the tone of the original email. "
                "If a user instruction is provided, follow it precisely."
            )
            human_content = (
                f"Subject: {email_context.subject}\n"
                f"Recipients: {recipients_str}\n\n"
                f"Email thread:\n{email_context.body}\n"
                f"{instruction_note}\n"
                f"Draft a reply."
            )

        prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content=system_content),
            HumanMessage(content=human_content),
        ])

        chain = prompt | self.llm
        return chain.invoke({}).content
