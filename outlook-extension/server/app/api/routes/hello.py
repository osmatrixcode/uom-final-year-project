from fastapi import APIRouter, Depends
from app.services.hello_world import helloWorldService

router = APIRouter()

def get_hello_world_service():
    return helloWorldService()

@router.get("/hello")
def say_hello_world(service: helloWorldService = Depends(get_hello_world_service)):
    greeting = service.get_hello_world()
    return {"message": greeting}
