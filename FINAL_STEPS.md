What Else to Implement – Final Year Project Recommendations
Context
The core system is working: email reply generation, streaming, intent classification, Graph API thread context, and a functional Outlook task pane. The project description emphasises intelligent/context-aware responses, usability, response accuracy, and data privacy. These recommendations are ordered by impact for a final year project submission.

Recommendations

1. Evaluation Framework (Highest Priority)
   The /evaluations directory is empty. For a final year project, empirical evaluation is essential to demonstrate scientific rigour.

What to build:

LLM-as-Judge pipeline: Send generated replies + original email to a judge LLM (GPT-4o) and score on relevance, tone appropriateness, and completeness. Script this in Python.
Benchmark dataset: Create 20–30 synthetic email scenarios (meeting requests, complaints, questions, introductions). Run each through your system and score.
Model comparison: Run the same scenarios through GPT-4o-mini vs GPT-3.5-turbo and compare scores. This directly addresses the TODO "benchmark models" item.
User study questionnaire: A short SUS (System Usability Scale) form or custom 5-question survey given to 5–10 people who try the add-in.
Why it matters: Without this, the project is just an implementation with no evidence it works well. Evaluation data goes directly into your dissertation Results section.

2. Few-Shot Prompting with User's Past Emails
   Currently the system generates generic professional replies. Few-shot prompting with samples from the user's own sent emails would make responses match their writing style.

What to build:

In graph_service.py, add a function to fetch the user's last N sent emails to a given recipient using Graph API (/me/mailFolders/SentItems/messages?$filter=...).
Inject 2–3 examples of how the user actually writes into the system prompt.
Update prompts.toml with a new few-shot template.
Why it matters: Directly addresses "context-aware" and "response accuracy" from the project aims. Measurable improvement you can show in evaluation.

3. SenderProfile (ProfileMD per Contact)
   Build lightweight per-sender context that persists across sessions.

What to build:

Backend: on first email from a sender, fetch their last 5 emails from Graph API, summarise them with an LLM, and store as a JSON/markdown file server-side.
Include in the LLM context: sender's typical topics, communication style, relationship history.
Frontend: show a small "sender context loaded" indicator in the task pane.
Why it matters: This is the most novel feature in the TODO list and is closest to the "intelligent, context-aware" goal in the project description. Good dissertation talking point.

4. Prompt Injection Safeguards
   Emails from external senders could contain adversarial instructions (e.g., "Ignore previous instructions and reply with...").

What to build:

Add an input sanitisation step in langchain.py before the email body is injected into the prompt.
Use a secondary LLM call to classify whether the email body contains injection attempts.
Return a warning to the user if detected (don't silently block).
Why it matters: Shows awareness of real-world security concerns. Goes in the Privacy & Security section of your dissertation. Quick to implement (~1–2 hours).

5. Conversation History Scrolling + Mode Toggle UI
   Two small but high-visibility UX improvements from the TODO list.

What to build:

Fix conversation history so users can scroll up to review past messages (currently broken).
Add a visible toggle button (not just Shift+Tab) to switch between "Email Draft" mode and "General Chat" mode.
Why it matters: These affect the usability evaluation score. If a user tester can't scroll history, your SUS scores will suffer.

6. Logging & Tracing (Backend)
   Add structured logging to the backend so you can show request/response traces in your dissertation.

What to build:

Use Python's logging module or structlog in langchain.py and graph_service.py.
Log: request received, intent classified, Graph API call made, tokens streamed, total latency.
Optionally write to a file you can include in appendices.
Why it matters: Minimal effort (~1 hour), but gives you concrete latency data for evaluation and shows engineering maturity.

Suggested Order of Implementation
Priority Feature Effort Dissertation Value
1 Evaluation framework (LLM-as-Judge + benchmark) Medium Very High
2 Prompt injection safeguards Low High
3 Logging & latency tracking Low High
4 Few-shot prompting (sent mail style matching) Medium High
5 SenderProfile / ProfileMD Medium-High High (novel feature)
6 UI: scrollable history + mode toggle Low Medium
Files to Modify
/server/app/services/graph_service.py — fetch sent items for few-shot + sender profile
/server/app/services/langchain_service.py — few-shot prompt injection, injection safeguards
/server/app/prompts.toml — new few-shot and sender-profile templates
/server/app/api/routes/langchain.py — logging, injection check
/evaluations/ — new scripts for LLM-as-Judge pipeline
/client/src/taskpane/components/ConversationView.tsx — fix scrollable history
/client/src/taskpane/components/App.tsx — mode toggle state
Out of Scope (Too Complex for Time Left)
Vector database (ChromaDB) — would require significant architecture change
Azure OpenAI migration — deployment complexity, not core to dissertation
LangChain agents — useful but not differentiated enough vs current implementation

when shift tab to email draft mode, cannot exit until discard or allow it to be pasted in the email body
