# Server Architecture

## Overview

Production-aligned FastAPI backend for an agentic AI email assistant, using LangChain/LangGraph. Follows a hybrid of the FastAPI enterprise pattern (Pattern 2) with top-level `agents/` (Pattern 3), based on research of production templates and LangChain's official docs.

## Folder Structure

```
server/
├── .env                        # API keys (OPENAI_API_KEY, etc.)
├── .env.example                # Template for other devs
├── requirements.txt            # Python dependencies
├── data/
│   └── chroma_db/              # Vector DB storage (gitignored)
├── scripts/
│   └── seed_vector_db.py       # One-time: populate vector DB
└── app/
    ├── __init__.py
    ├── main.py                 # FastAPI app, CORS, router registration
    ├── api/
    │   ├── __init__.py
    │   ├── deps.py             # Centralized dependency injection
    │   └── routes/             # HTTP layer (thin)
    │       ├── __init__.py
    │       ├── hello.py        # GET /hello
    │       └── agent.py        # POST /agent
    ├── schemas/                # Pydantic request/response models
    │   └── __init__.py
    ├── agents/                 # LangGraph agent definitions
    │   └── __init__.py
    ├── tools/                  # Functions agents can call
    │   └── __init__.py
    ├── core/
    │   ├── __init__.py
    │   ├── config.py           # Pydantic Settings (validated env vars)
    │   └── prompts/            # Prompt templates
    │       └── __init__.py
    └── services/               # Infrastructure clients
        ├── __init__.py
        ├── llm.py              # get_llm() factory
        ├── vector_store.py     # get_vector_store() factory
        └── hello_world.py      # Non-AI services
```

## Layer Responsibilities

| Layer | Role | Changes often? |
|---|---|---|
| `api/routes/` | HTTP request/response only (thin) | Rarely |
| `api/deps.py` | Centralized dependency injection (auth, DB, LLM) | Rarely |
| `schemas/` | Pydantic models — API contract | Occasionally |
| `agents/` | LangGraph graphs (nodes, edges, state, decisions) | Frequently |
| `tools/` | Functions agents decide to call | Frequently |
| `core/prompts/` | Prompt templates | Frequently |
| `core/config.py` | Validated env vars (fails fast if missing) | Rarely |
| `services/` | Infrastructure clients (LLM, vector DB, etc.) | Rarely |
| `scripts/` | One-time tasks (seed DB, migrations) | Rarely |
| `data/` | Generated storage (vector DB files) | Never (gitignored) |

## Data Flow

```
Request → routes/ → agents/ → tools/ + services/ + core/prompts/
                             → Response
```

## How Agents Work (LangGraph)

An agent is a **graph of steps** (not a single LLM call). Each node is a function, and edges define the flow. The LLM decides which path to take.

```python
# agents/email_agent.py
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode
from app.services.llm import get_llm
from app.tools.email_tools import get_email_body
from app.tools.knowledge_tools import search_knowledge_base

tools = [get_email_body, search_knowledge_base]
llm = get_llm().bind_tools(tools)

def agent_node(state):
    response = llm.invoke(state["messages"])
    return {"messages": [response]}

def should_use_tool(state):
    if state["messages"][-1].tool_calls:
        return "tools"
    return END

graph = StateGraph(dict)
graph.add_node("agent", agent_node)
graph.add_node("tools", ToolNode(tools))
graph.add_edge(START, "agent")
graph.add_conditional_edges("agent", should_use_tool)
graph.add_edge("tools", "agent")

email_agent = graph.compile()
```

**Flow:**
```
START → agent → (needs tool?) → YES → run tool → back to agent
                              → NO  → END
```

## How Tools Work

Tools are functions decorated with `@tool` that agents can **decide** to call:

```python
# tools/knowledge_tools.py
from langchain_core.tools import tool
from app.services.vector_store import get_vector_store

@tool
def search_knowledge_base(query: str) -> str:
    """Search past emails and company docs for relevant context."""
    store = get_vector_store()
    results = store.similarity_search(query, k=3)
    return "\n".join([doc.page_content for doc in results])
```

The LLM reads the docstring to understand what the tool does, then decides when to use it.

## Services Pattern

Services are **infrastructure clients** — like database connections. They configure and return instances. No business logic.

```python
# services/llm.py — LLM client factory
import os
from langchain_openai import ChatOpenAI

def get_llm(model: str = "gpt-4o-mini") -> ChatOpenAI:
    return ChatOpenAI(model=model, api_key=os.getenv("OPENAI_API_KEY"))
```

```python
# services/vector_store.py — Vector DB client factory
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma

def get_vector_store() -> Chroma:
    return Chroma(
        persist_directory="./data/chroma_db",
        embedding_function=OpenAIEmbeddings(api_key=os.getenv("OPENAI_API_KEY"))
    )
```

## Vector DB (Chroma)

- **Persists to disk** at `data/chroma_db/` — survives server restarts
- Seed with `python -m scripts.seed_vector_db`
- Agents query it via tools (RAG pattern)
- Add `data/chroma_db/` to `.gitignore`

## Design Decisions

| Decision | Rationale |
|---|---|
| `agents/` at top level | Most frequently changed code — easy to find, not buried |
| No `ai/` folder | Too broad. `agents/`, `tools/`, `services/llm.py` are more precise |
| LLM config in `services/` | It's infrastructure (like a DB client), not business logic |
| Hello world prompt in route | Temporary demo — will be replaced by real agents |
| `core/config.py` with Pydantic Settings | Validates env vars at startup — fails fast with clear errors |
| `schemas/` directory | Keeps routes clean, enforces API contract |
| `api/deps.py` | Centralizes dependency injection — avoids scattering across routes |

## References

- [FastAPI + LangGraph Production Template](https://github.com/wassim249/fastapi-langgraph-agent-production-ready-template)
- [Agent Service Toolkit](https://github.com/JoshuaC215/agent-service-toolkit)
- [LangGraph Application Structure (Official Docs)](https://docs.langchain.com/langgraph-platform/application-structure)
