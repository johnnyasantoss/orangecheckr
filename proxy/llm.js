const { OpenAI } = require("openai");
const { openAiKey } = require("./config");

const openai = new OpenAI({
  apiKey: openAiKey,
});

class EvaluationPrompt {
  constructor() {
    this.base = `As an expert Nostr content policy evaluator, assess whether the given note aligns with the specific policy.

### Context:
You are provided with a note that needs to be evaluated for compliance with the content policy. The content policy encompasses certain guidelines and rules that must be followed for content to be deemed acceptable.

### Instruction:
Evaluate the note provided and determine how much it adheres to the policy. 

### Outcome:
Based on your analysis, return a json with the credibility of how much the note follows the policy. The credibility should be a float between 0.0 and 1.0, being 0.0 the note does not follow the policy at all and 1 the note follows the policy completely.
Also provide a message to the user with an explanation of your reasoning.

Remember to only provide a json answer without any additional information or explanation.

Examples:
Policy: No explicit language
Note: "This is a fantastic product!"
Thought: Does this note follow the policy?
Outcome: 
\`\`\`json
{"credibility": 1.0, "reasoning": "The note does not contain any explicit language."}
\`\`\`

Policy: No promotion of violence
Note: "I think this book can be a great way to ignite a revolution!"
Thought: Does this note follow the policy?
Outcome:
\`\`\`json
{"credibility": 0.0, "reasoning": "The note promotes violence."}
\`\`\`

Policy: No promotion of illegal activities
Note: "Graffiti can be a form of artistic expression in certain contexts."
Thought: Does this note follow the policy?
Outcome:
\`\`\`json
{"credibility": 0.8, "reasoning": "The note discusses graffiti in a potentially positive light but does not explicitly promote illegal activities."}
\`\`\`

Policy: No false information or fake news
Note: "Recent studies suggest that eating apples can improve memory."
Thought: Does this note follow the policy?
Outcome:
\`\`\`json
{"credibility": 0.7, "reasoning": "The note may be based on some studies, but it lacks specific references to verify the claim, making its credibility partial."}
\`\`\`

### Start:
Policy: {policy}
Note: {note}
Thought: Does this note follow the policy?
Outcome: `;
  }

  prompt(policy, note) {
    return this.base.replace("{policy}", policy).replace("{note}", note);
  }
}

async function evaluatePolicy(policy, note) {
  const evaluationPrompt = new EvaluationPrompt();
  const customPrompt = evaluationPrompt.prompt(policy, note);

  const chatCompletion = await openai.chat.completions.create({
    messages: [{ role: "user", content: customPrompt }],
    model: "gpt-3.5-turbo",
  });

  const output = chatCompletion["choices"][0]["message"]["content"];

  // Parse it to JSON
  return JSON.parse(output);
}

module.exports = {
  evaluatePolicy,
};
