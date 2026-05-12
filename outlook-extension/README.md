# The University of Manchester: Third Year Project (Ameer Osman Yousufzia)

this is my repo for my final year project for my undegrad course (BSc Compueter Science & Mathematics).

### Intelligent Email Assistance: Seamless Integration of Large Language Models into Outlook Workflows

The integration of Large Language Models (LLMs) like ChatGPT into everyday productivity tools has the potential to significantly transform workplace communication by automating routine tasks such as drafting and responding to emails. Despite the rapid adoption of LLMs in general-purpose applications, their seamless incorporation into established enterprise workflows, especially within widely-used platforms like Microsoft Outlook, remains limited. This gap restricts the practical benefits of LLMs in enhancing efficiency, consistency, and communication quality in professional environments.
To address this, the project aims to develop a prototype application that integrates an LLM into the Microsoft Outlook email client, enabling intelligent and context-aware automatic email response generation. The system will extract relevant content from incoming emails, use this content to formulate prompts for the LLM, and generate suggested replies that the user can edit, approve, or discard. The prototype will be designed to operate with minimal disruption to the existing workflow, with a strong emphasis on usability, response accuracy, and data privacy.

## Setup

### Frontend

1. **Register your application in Azure Portal** (required for Graph API authentication):
   - Register an app in [Azure Portal](https://portal.azure.com)
   - Note your **Client ID** — you'll need this for the frontend MSAL configuration
   - The backend also requires a **Client Secret** and **Redirect URI**

2. Install dependencies in `client/`:

   ```bash
   cd client
   npm install
   ```

3. Start the dev server:

   ```bash
   npm run dev-server
   ```

   This runs Webpack on `https://localhost:3000`.

4. Sideload the add-in manually in Outlook:
   - Follow [Microsoft's sideload guide](https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/sideload-outlook-add-ins-for-testing?tabs=xmlmanifest#sideload-manually)
   - **Important:** Select the manifest from `client/dist/` (not `client/`). The source `manifest.xml` contains `__AZURE_CLIENT_ID__` placeholders that are substituted with the real UUID from `.env` during the build step.

5. Test in Outlook:
   - Open an email and click **Reply**
   - Click the **APP** icon → select this add-in → **Show Task Pane**

### Backend

1. Create and activate the conda environment:

   ```bash
   cd server
   conda env create -f environment.yml
   conda activate fyp-server
   ```

2. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and fill in:
   - `OPENAI_API_KEY` — your OpenAI API key
   - `MS_CLIENT_ID` — your Microsoft Azure app client ID
   - `MS_CLIENT_SECRET` — your Microsoft Azure app client secret
   - `MS_REDIRECT_URI` — your OAuth redirect URI (e.g., `http://localhost:8000/auth/callback`)

3. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### Microsoft Graph API Setup

Setting up Microsoft Graph API authentication is the most complex part of this project. You'll need to:

- Register an application in Azure Portal
- Configure OAuth scopes and permissions
- Set up client secrets and redirect URIs

Follow this guide for detailed steps: https://medium.com/nerd-for-tech/query-ms-graph-api-in-python-e8e04490b04e

## Tech Stack

- **Frontend**: React 18, TypeScript, Webpack, Fluent UI, MSAL (OAuth)
- **Backend**: FastAPI, LangChain, OpenAI models
- **Persistence**: SQLite (`profiles.db`) for per-sender tone profiles and per-thread notes
- **Safety & Moderation**:
  - **LLM-Guard** — local models (HuggingFace transformers, ONNX) for prompt injection detection and PII anonymisation
  - **OpenAI Moderation API** — content policy filtering
- **Office Integration**: Office.js API
