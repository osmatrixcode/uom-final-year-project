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

        prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content=(
                "You are a professional email assistant. "
                "Draft a clear, concise, professional reply to the email thread. "
                "Write only the reply body — no subject line, no greeting preamble, no sign-off. "
                "Match the tone of the original email."
            )),
            HumanMessage(content=(
                f"Subject: {email_context.subject}\n"
                f"Recipients: {recipients_str}\n\n"
                f"Email thread:\n{email_context.body}\n\n"
                f"Draft a reply."
            )),
        ])

        chain = prompt | self.llm
        return chain.invoke({}).content
