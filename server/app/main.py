# app/main.py
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.hello import router as hello_router
from app.api.routes.langchain import router as langchain_router

app = FastAPI(title="Layered Hello World")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://localhost:3000", "https://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(hello_router)
app.include_router(langchain_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)