# app/api/routes.py
from fastapi import APIRouter, Depends
from app.services.hello_world import helloWorldService

router = APIRouter()

# We define a function to provide the service
def get_hello_world_service():
    return helloWorldService()

@router.get("/hello")
def say_hello_world(service: helloWorldService = Depends(get_hello_world_service)):
    # The router only handles the request/response flow
    greeting = service.get_hello_world()
    return {"message": greeting}