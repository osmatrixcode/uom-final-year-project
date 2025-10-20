# The University of Manchester: Third Year Project (Ameer Osman Yousufzia)

this is my repo for my final year project for my undegrad course (BSc Compueter Science & Mathematics). Don't worry! This repo will be populated soon

### Intelligent Email Assistance: Seamless Integration of Large Language Models into Outlook Workflows

The integration of Large Language Models (LLMs) like ChatGPT into everyday productivity tools has the potential to significantly transform workplace communication by automating routine tasks such as drafting and responding to emails. Despite the rapid adoption of LLMs in general-purpose applications, their seamless incorporation into established enterprise workflows, especially within widely-used platforms like Microsoft Outlook, remains limited. This gap restricts the practical benefits of LLMs in enhancing efficiency, consistency, and communication quality in professional environments.
To address this, the project aims to develop a prototype application that integrates an LLM into the Microsoft Outlook email client, enabling intelligent and context-aware automatic email response generation. The system will extract relevant content from incoming emails, use this content to formulate prompts for the LLM, and generate suggested replies that the user can edit, approve, or discard. The prototype will be designed to operate with minimal disruption to the existing workflow, with a strong emphasis on usability, response accuracy, and data privacy.

### what need to do:

- npm run dev-server (in client folder)
- go to https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/sideload-outlook-add-ins-for-testing?tabs=xmlmanifest#sideload-manually
- add this add in manually! (manual sideload)
- click an email and press 'reply' then press APP icon and press this add in and press show task pane!

### TODOs

- utilise docker
- utilise good readme to show how to use this office add in
  - make sure they add OpenAI API
- find way to 'deploy' this?
- fix package.json and manifest.json (cannot automatically sideload the addin for some reason)
- when manually sideloaded, and run npm run dev-server, it doesnt load all the time? :(

### COMPETITOR ANALYSIS:

#### Copilot in Outlook (its capabilities)

I can help you with emails in several ways, depending on what you need. Here are some examples:
📧 Writing & Editing Emails

Draft professional, academic, or casual emails.
Improve grammar, tone, and clarity.
Translate emails between languages.
Make your message more persuasive or polite.

🗂️ Organizing & Managing Email Tasks

Help you create templates for recurring emails.
Suggest subject lines that increase open rates.
Assist with follow-up strategies or reminders.

🧠 Understanding & Responding to Emails

Summarize long emails.
Help you craft thoughtful replies.
Identify key points or action items.

🛠️ Technical Help

Guide you on how to use email features (e.g., filters, folders, signatures).
Help troubleshoot email issues (e.g., formatting, delivery problems).

Would you like help drafting an email right now? If so, just tell me:

Who it’s for
What it’s about
Any tone or style preferences

Or let me know what kind of email-related help you’re looking for!
