# app/main.py
import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"  # Prevent OpenMP conflict between PyTorch and ONNX Runtime on macOS

import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)-8s %(name)s: %(message)s",
)

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.hello import router as hello_router
from app.api.routes.langchain import router as langchain_router
from app.api.routes.graph import router as graph_router
from app.api.routes.profiles import router as profiles_router
from app.api.routes.threads import router as threads_router

app = FastAPI(title="Intelligent AI Email Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://localhost:3000", "https://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(hello_router)
app.include_router(langchain_router)
app.include_router(graph_router)
app.include_router(profiles_router)
app.include_router(threads_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)