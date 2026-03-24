# The University of Manchester: Third Year Project (Ameer Osman Yousufzia)

this is my repo for my final year project for my undegrad course (BSc Compueter Science & Mathematics). Don't worry! This repo will be populated soon

### Intelligent Email Assistance: Seamless Integration of Large Language Models into Outlook Workflows

The integration of Large Language Models (LLMs) like ChatGPT into everyday productivity tools has the potential to significantly transform workplace communication by automating routine tasks such as drafting and responding to emails. Despite the rapid adoption of LLMs in general-purpose applications, their seamless incorporation into established enterprise workflows, especially within widely-used platforms like Microsoft Outlook, remains limited. This gap restricts the practical benefits of LLMs in enhancing efficiency, consistency, and communication quality in professional environments.
To address this, the project aims to develop a prototype application that integrates an LLM into the Microsoft Outlook email client, enabling intelligent and context-aware automatic email response generation. The system will extract relevant content from incoming emails, use this content to formulate prompts for the LLM, and generate suggested replies that the user can edit, approve, or discard. The prototype will be designed to operate with minimal disruption to the existing workflow, with a strong emphasis on usability, response accuracy, and data privacy.

### RUN THE FRONTEND

- Download npm files in /client directory
- npm run dev-server (in client folder)
- go to https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/sideload-outlook-add-ins-for-testing?tabs=xmlmanifest#sideload-manually
- add this add in manually! (manual sideload)
- click an email and press 'reply' then press APP icon and press this add in and press show task pane!

-setup microsoft graph API
https://medium.com/nerd-for-tech/query-ms-graph-api-in-python-e8e04490b04e

## RUN THE BACKEND

- create conda environment
- install pip
- install requirements.txt
- create .env file and paste your AI API
- fastapi dev app/main.py to start the server

### THANKS (inspiration)

FRONTEND COOKIE MONSTER
https://www.figma.com/community/file/1530305855415503769
