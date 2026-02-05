### 19/10/2025

- struggled with initialising an outlook addin template?
  - had to extensively read docs and discussions (as docs seem outdated)
  - found solution: had to manually sideload the addin and refresh processes (AND NOW IT WORKS)
- the add in didn't load properly in my outlook client due to TS errors
  - problem was @fluentui and import/export problems
  - removed @fluentui (icons) as uneccessary!
  - fixed TS warning flags

### 25/10/2025

- initially didn't want to pay for AI credits, decided to go with local model
- local model still slow (even 1B) compared to chatGPT website
- local model cannot do function/tool calling, making it hard for AI agents with Langchain
- all AI companies have different API implementations, so decided to use langchain (unified API)
- put 5$ into OpenAI credits, use mini model as extremely cheap and can do tool calling
- look at temperature and seed, as gives different responses
- looked at JSON response, cannot do JSON response with agent, so use second model to clean it into JSON
  - above is expensive?
  - need to decide if want to go with Agentic structure OR just simple chat completions with StructuredOutput object in Langchain?
  - if go with simple chat completions, maybe small ollama is enough? (will it take long however for Vector DB searching etc...), how to ensure structuredOutput with ollama models
- I discovered this in separate project, will this week create simple structured format with OpenAI response and Ollama response and simple agentic response

## 26/10/2025

- Setup initial fastAPI server
- Frontend, realised cannot put UI and data fetching in the same place, so best to have component/hooks/services structure (something I learned!)
  - this is something new I learned, usually would put it all into one file
  - tanstack query is what I used (industry standard)
- was wondering what "..." means in typescript code
- learnt about 'DRY' when creating apiClient, also spread operator and immutability in React (dont effect original copy, just create a new one)
- learnt about RequestInit object in fetch for
  - what is an interface in TS?
- implement CORS in the backend and config.ts in the frontend
- need to wrap index root in frontend, with QueryProvider, also forget to put custom hook useState INSIDE the function!
- SERVICE: for raw api calls and transformations, HOOK: Query behaviour and retries etc..., COMPONENT: to display the data

## 5/2/2026

- planning to change backend to be javascript backend
  - langchain JS
  - simple API call?
