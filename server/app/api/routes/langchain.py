from fastapi import APIRouter, Depends
from app.services.langchain_service import LangChainService

router = APIRouter()

def get_langchain_service():
    return LangChainService()

@router.get("/langchain-hello")
def say_langchain_hello(service: LangChainService = Depends(get_langchain_service)):
    response = service.get_hello()
    return {"message": response}
