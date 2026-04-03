So there are no template variables in current prompt (due to architecture backend structure in outlook extension)

to test classifiers with promptfoo, it is best to append the variables at the end of the message:

## """

User instruction: {{instruction}}
Assistant response: {{llm_output}}
"""
