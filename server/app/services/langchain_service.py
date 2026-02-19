import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage


class LangChainService:
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4o-mini",
            api_key=os.getenv("OPENAI_API_KEY")
        )

    def get_hello(self) -> str:
        response = self.llm.invoke([HumanMessage(content="Say hello in one sentence.")])
        return response.content
