# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router as hello_router

app = FastAPI(title="Layered Hello World")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://localhost:3000", "https://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include our routes
app.include_router(hello_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)