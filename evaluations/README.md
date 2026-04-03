# Evaluations

This folder contains a collection of evaluation suites for testing and validating the functionality of different modes and features in the project. These evaluations serve as a playground for experimentation and are structured to be included in the final report.

## Overview

The evaluations are built using [PromptFoo](https://promptfoo.dev/), a framework for systematically testing AI applications. Each subdirectory represents a different evaluation suite organized by feature or mode.

## Getting Started

1. **Explore Template Variables**: Each evaluation suite includes an `example-template-vars.json` file that demonstrates typical variable values and structure. Review these to understand what data is expected.

2. **Run Evaluations**: Use the PromptFoo CLI to run evaluations:

   ```bash
   promptfoo eval -c <path-to-eval-config>
   ```

3. **Generate Synthetic Data**: If you need additional test data, use the PromptFoo CLI to generate more synthetic data:

   ```bash
   promptfoo generate <path-to-eval-config>
   ```

4. **Customize**: Feel free to modify the evaluation configs and create your own test scenarios (e.g., different personas, edge cases, etc.)

## Tips

- Review `example-template-vars.json` files to understand the expected data structure
- Create custom template variables tailored to specific test personas or scenarios
- Use this folder as a playground to experiment with different prompts and configurations
- Results can be used to validate improvements and document performance in your report
