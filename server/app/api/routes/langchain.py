from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from app.services.langchain_service import LangChainService

router = APIRouter()


class EmailRecipient(BaseModel):
    displayName: str
    emailAddress: str


class EmailContextRequest(BaseModel):
    subject: str
    body: str
    recipients: List[EmailRecipient]
    draft: Optional[str] = None


class GenerateReplyResponse(BaseModel):
    reply: str


def get_langchain_service():
    return LangChainService()


@router.get("/langchain-hello")
def say_langchain_hello(service: LangChainService = Depends(get_langchain_service)):
    response = service.get_hello()
    return {"message": response}


@router.post("/generate-reply", response_model=GenerateReplyResponse)
def generate_reply(
    request: EmailContextRequest,
    service: LangChainService = Depends(get_langchain_service),
):
    reply = service.generate_email_reply(request)
    return GenerateReplyResponse(reply=reply)
