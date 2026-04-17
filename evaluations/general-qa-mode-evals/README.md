To get started, set your OPENAI_API_KEY environment variable, or other required keys for the providers you selected.

Next, edit promptfooconfig.yaml.

Then run:
```
promptfoo eval
```

Afterwards, you can view the results by running `promptfoo view`


### how to generate synthetic test cases
promptfoo generate dataset \
  -c promptfooconfig.yaml \
  -o tests.yaml \
  --numPersonas 5 \
  --numTestCasesPerPersona 10