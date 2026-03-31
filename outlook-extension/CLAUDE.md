# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Intelligent Email Assistance Outlook Add-in — a Microsoft Outlook desktop add-in that uses LLMs to generate email replies, answer questions about email threads, and manage per-sender tone profiles. Final-year project for BSc Computer Science & Mathematics at the University of Manchester.

## Development Commands

### Client (React/TypeScript) — run from `client/`

```bash
npm run dev-server      # Webpack dev server on https://localhost:3000
npm run build           # Production build
npm run build:dev       # Development build
npm run lint            # ESLint check
npm run lint:fix        # Auto-fix lint issues
npm run validate        # Validate manifest.xml
```

### Server (FastAPI/Python) — run from `server/`

```bash
uvicorn app.main:app --reload --port 8000
```

Requires `.env` with `OPENAI_API_KEY`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_REDIRECT_URI`.

### Manual Sideloading (Required)

Automatic sideloading doesn't work. To test:
1. `npm run dev-server` in `client/`
2. `uvicorn app.main:app --reload --port 8000` in `server/`
3. In Outlook: click an email → Reply → APP icon → select add-in → Show Task Pane

No automated test suite exists. Testing is manual via the Outlook task pane.

## Architecture

### Three Operating Modes

The task pane has three modes (cycled with Ctrl+/):
- **general_qa** — ask questions about the email thread (bubble-style chat)
- **email_draft** — generate or refine a reply draft (persistent DraftBox)
- **sender_edit** — view/edit per-sender profiles and per-thread notes

### Data Flow (email_draft)

1. Client reads email context via Office.js (`taskpane.ts` → `getEmailContext()`)
2. `App.tsx` calls `streamGenerateReply()` → `POST /generate-reply/stream`
3. Route handler in `langchain.py` fetches Graph thread (if authenticated) and loads SQLite profiles/notes via `_build_injected_context()`
4. `LangChainService.stream_email_reply()` fills a prompt template from `prompts.toml`, streams tokens from GPT-4o-mini via LangChain
5. SSE events (`intent`, `token`, `done`) flow back to the client
6. User can edit the draft in DraftBox, then "Insert reply" writes to the Outlook compose body

### Server (`server/app/`)

**Routes** (`api/routes/`):
- `langchain.py` — `POST /generate-reply` and `POST /generate-reply/stream` (SSE). Accepts `EmailContextRequest` with subject, body, recipients, mode, optional draft/instruction. Enriches with Graph thread + SQLite profiles before calling LLM.
- `profiles.py` — CRUD for per-sender profiles (`GET/PUT/DELETE /profiles/{email}`, `POST /profiles/{email}/generate` for AI auto-fill)
- `threads.py` — CRUD for per-thread notes (`GET/PUT /threads/{conversation_id}`, `POST /threads/{conversation_id}/generate`)
- `graph.py` — Microsoft Graph OAuth login/callback, `/me`, `/me/messages`

**Services** (`services/`):
- `langchain_service.py` — Core LLM logic. Loads prompt templates from `prompts.toml` at import time into `_PROMPT_CACHE`. Three prompt keys: `generate_reply`, `refine_draft`, `general_qa`. Strips accidental email headers from LLM output. `generate_profile_text()` handles AI auto-fill for profiles/notes.
- `graph_service.py` — Microsoft Graph API calls using MSAL. `get_thread_by_conversation_id()` fetches conversation history. `graph_get_with_token()` for arbitrary Graph calls with NAA token.
- `profile_service.py` — SQLite wrapper for `profiles.db` (auto-created at `server/profiles.db`). Two tables: `profiles` (email → prompt_text) and `thread_notes` (conversation_id → note_text).
- `token_validator.py` — Validates NAA Bearer tokens via Graph `/me`.

**Prompts** (`prompts.toml`):
Edit this file to tune LLM behaviour. Variables in `{curly_braces}` are filled at runtime. `{thread_context}` includes both Graph conversation history and injected personalisation context (sender profiles + thread notes).

### Client (`client/src/taskpane/`)

**Key components** (`components/`):
- `App.tsx` — Central state manager. Owns messages, mode, draft, sender selection. Orchestrates all mode-specific UI.
- `ChatInput.tsx` — Text input with mode indicator and Ctrl+/ switching. Mode-locked during active email_draft.
- `DraftBox.tsx` — Persistent draft editor for email_draft mode (import from compose, edit, insert/discard).
- `SenderList.tsx` — Shows To/CC recipients when in sender_edit mode. Fetched via `getSenders()`.
- `SenderProfilePanel.tsx` — Per-sender editable textarea with auto-save (450ms debounce) and AI auto-fill button.
- `ThreadNotePanel.tsx` — Per-thread editable textarea, same pattern as SenderProfilePanel.

**Services** (`services/`):
- `basicService.ts` — `streamGenerateReply()` (SSE fetch + TextDecoder), `fetchProfile/saveProfile`, `fetchThreadNote/saveThreadNote`, `generateProfile/generateThreadNote`
- `apiClient.ts` — Axios instance with automatic NAA token injection via interceptor
- `authService.ts` — MSAL/NAA token acquisition (localStorage cache)

**Office.js integration** (`taskpane.ts`):
- `getEmailContext()` — reads compose subject, body, To recipients
- `getSenders()` — reads To + CC (with body-parsing fallback for CC in Reply mode)
- `getConversationId()` — thread ID (stable across replies)
- `insertText()` — replaces compose body with generated HTML

### Key Design Decisions

- **Prompt templates in TOML** (`prompts.toml`) — editable without touching Python
- **SSE streaming** — tokens streamed via `text/event-stream`, not WebSockets
- **SQLite for persistence** — `profiles.db` auto-created, no migrations needed. Used for sender profiles and thread notes only.
- **NAA (Nested App Authentication)** — client acquires token via MSAL silently from user's Outlook session, passes as Bearer to server, server uses it for Graph API calls
- **Injected context** — sender profiles and thread notes from SQLite are appended to `{thread_context}` in the prompt, so they're invisible to the user but guide LLM tone/style

## Tech Stack

- **Frontend**: React 18, TypeScript 5.4, Webpack 5, Fluent UI 9, TanStack Query 5, MSAL Browser
- **Backend**: Python FastAPI, LangChain, OpenAI GPT-4o-mini, MSAL, SQLite
- **Office Integration**: office-js API via `Office.context.mailbox`

## Configuration

- Client dev server: `https://localhost:3000`
- Backend API: `http://localhost:8000` (configured in `client/src/taskpane/config.ts`)
- CORS: localhost:3000 and localhost:3001
- Add-in manifest: `client/manifest.xml`
