from langchain.prompts import PromptTemplate

BASE = """As an expert Nostr content policy evaluator, assess whether the given note aligns with the specific policy.

### Context:
You are provided with a note that needs to be evaluated for compliance with the content policy. The content policy encompasses certain guidelines and rules that must be followed for content to be deemed acceptable.

### Instruction:
Evaluate the note provided and determine how much it adheres to the policy. 

### Outcome:
Based on your analysis, return a json with the credibility of how much the note follows the policy. The credibility should be a float between 0.0 and 1.0, being 0.0 the note does not follow the policy at all and 1 the note follows the policy completely.
Also provide a message to the user with an explanation of your reasoning.

Remember to only provide a json answer without any additional information or explanation.

Positive example:
Policy: No explicit language
Note: "This is a fantastic product!"
Thought: Does this note follow the policy?
Outcome: 
```json
{{"credibility": 1.0, "reasoning": "The note does not contain any explicit language."}}
```

Negative Example:
Policy: No promotion of violence
Note: "I think this book can be a great way to ignite a revolution!"
Thought: Does this note follow the policy?
Outcome:
```json
{{"credibility": 0.0, "reasoning": "The note promotes violence."}}
```

### Start:
Policy: {policy}
Note: {note}
Thought: Does this note follow the policy?
Outcome: """


class DefaultDict(dict):
    def __missing__(self, key):
        return "{" + key + "}"


class EvaluationPrompt:
    def __init__(
        self,
    ):
        self.base = BASE

    def prompt(self):
        return PromptTemplate(
            template=self.base,
            input_variables=["policy", "note"],
        )
