# Intelligent Email Assistant — Outlook Add-in

A Microsoft Outlook add-in that integrates AI directly into the email compose workflow. It generates context-aware reply drafts, answers questions about email threads, and lets you maintain per-sender tone profiles — all without leaving Outlook.

Built as a final-year project for BSc Computer Science & Mathematics at the University of Manchester.

---

## Features

- **Email Draft mode** — generate or refine a reply draft from the current email thread
- **General QA mode** — ask questions about the email you're reading
- **Sender Edit mode** — create and manage per-sender tone/style profiles and per-thread notes
- **Microsoft Graph integration** — enriches prompts with full conversation history when authenticated
- **Streaming responses** — tokens stream via SSE so the UI feels responsive
- **Security & privacy pipeline** — PII is anonymised before it ever reaches the LLM (see below)

---

## Repository Structure

```
.
├── outlook-extension/      # The Outlook add-in (client + server)
│   ├── client/             # React/TypeScript task pane (Webpack, Office.js)
│   └── server/             # FastAPI backend (Python, LangChain, LLM Guard)
└── evaluations/            # PromptFoo evaluation suites for each mode
```

---

## Security & Privacy Pipeline

Every request passes through a layered pipeline before reaching the LLM and before returning to the user.

```
User Input
    │
    ▼  1. PII Anonymisation      (LLM Guard — NER model, ONNX)
    ▼  2. Prompt Injection Scan  (LLM Guard — invisible text + ML classifier)
    ▼  3. Moderation API         (OpenAI omni-moderation-latest)
    │
   LLM 
    │
    ▼  4. Scope Classifier       
    ▼  5. Output Injection Scan  (LLM Guard — same scanner as step 2)
    ▼  6. Output Moderation      (OpenAI Moderation API)
    ▼  7. Deanonymisation        (LLM Guard — restores PII placeholders)
    │
User Response
```

PII (names, email addresses, phone numbers, etc.) is replaced with tokens like `[PERSON_1]` before any downstream service — including the injection scanner and moderation API — ever sees it. Real values are only restored in the final deanonymisation step.

Email bodies are treated differently from user instructions: invisible-text attacks are always blocked, but ML-detected injection in an email body is logged without blocking (the user cannot rephrase someone else's email).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript 5, Webpack 5, Fluent UI 9, MSAL Browser |
| Backend | Python, FastAPI, LangChain, OpenAI |
| Office integration | Office.js, Nested App Authentication (NAA) |
| Graph API | MSAL Python, Microsoft Graph REST API |
| Privacy | LLM Guard (HuggingFace / ONNX) — Anonymize + Deanonymize |
| Security | LLM Guard — PromptInjection + InvisibleText |
| Moderation | OpenAI Moderation API |
| Persistence | SQLite (`profiles.db`) — sender profiles + thread notes |
| Evaluations | PromptFoo |

---

## Setup

### Prerequisites

- Node.js 18+
- Python 3.11+ (conda recommended)
- An [Azure app registration](https://portal.azure.com) with Microsoft Graph permissions
- An OpenAI API key or AI API Key of your choice

---

### Backend

```bash
cd outlook-extension/server
conda env create -f environment.yml
conda activate fyp-server
cp .env.example .env
```

Edit `.env`:

```
OPENAI_API_KEY=sk-...
MS_CLIENT_ID=<azure-app-client-id>
MS_CLIENT_SECRET=<azure-app-client-secret>
MS_REDIRECT_URI=http://localhost:8000/auth/callback
```

Start the server:

```bash
uvicorn app.main:app --reload --port 8000
```

The server runs on `http://localhost:8000`. On first startup, LLM Guard downloads its NER and injection models (~200 MB, cached after the first run).

---

### Frontend

```bash
cd outlook-extension/client
npm install
cp .env.example .env
```

Edit `.env` and set your Azure app Client ID.

Start the dev server:

```bash
npm run dev-server   # https://localhost:3000
```

Sideload the add-in into Outlook:

1. Follow [Microsoft's manual sideload guide](https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/sideload-outlook-add-ins-for-testing?tabs=xmlmanifest#sideload-manually)
2. Select the manifest from `client/dist/` — the source `manifest.xml` contains `__AZURE_CLIENT_ID__` placeholders that the build step replaces with the real value from `.env`

To test:

1. Open an email in Outlook and click **Reply**
2. Click the **APP** icon → select this add-in → **Show Task Pane**
3. Cycle modes with **Ctrl+/**

---

### Azure / Microsoft Graph Setup

Register an application in [Azure Portal](https://portal.azure.com):

- Note your **Client ID** (needed for both client and server `.env`)
- Generate a **Client Secret** (server only)
- Add a **Redirect URI**: `http://localhost:8000/auth/callback`
- Grant delegated Graph permissions: `Mail.Read`, `User.Read`

---

## Evaluations

The `evaluations/` directory contains [PromptFoo](https://promptfoo.dev/) evaluation suites for each mode and safety classifier.

```
evaluations/
├── email-draft-mode-evals/
│   ├── generate-reply-eval/     # Prompt variants: simple, CoT, few-shot
│   └── refine-draft-eval/
├── general-qa-mode-evals/
├── sender-edit-mode-evals/
│   ├── generate-sender-profile-eval/
│   ├── generate-thread-note-eval/
│   └── refine-profile-text-eval/
└── classifier-evals/            # Safety classifier accuracy tests
    ├── safety-classifier-eval/
    ├── email-draft-safety-classifier-eval/
    └── sender-edit-safety-classifier-eval/
```

Run any suite:

```bash
cd evaluations/<suite-name>
cp .env.example .env   # add your OPENAI_API_KEY
promptfoo eval -c promptfooconfig.yaml
```

Each suite includes an `example-template-vars.json` showing the expected input structure.

---

## Configuration

| File | Purpose |
|---|---|
| `server/app/prompts.toml` | All LLM prompt templates — edit without touching Python |
| `client/src/taskpane/config.ts` | API URL (`http://localhost:8000` in dev) |
| `server/.env` | API keys and Microsoft credentials |
| `client/.env` | Azure Client ID for MSAL |

---


