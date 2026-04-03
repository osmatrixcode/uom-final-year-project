# Classifier Evaluation Setup

## Template Variables

The classifier prompts don't currently use template variables due to the Outlook extension's backend architecture. To test classifiers with promptfoo, append the test variables at the end of the message:

```
User instruction: {{instruction}}
Assistant response: {{llm_output}}
```

Where:

- `{{instruction}}` - The user's input/instruction to be classified
- `{{llm_output}}` - The LLM's response that needs classification

**Note:** Unfortunately, we don't have example template variables as a json for this evaluation yet.
