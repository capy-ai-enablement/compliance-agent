# Compliance-agent

Focus on this project is to built something that creates value using as much AI tooling as possible.

## Features

User features

- Interact through conversations
- Point to your repo
- The agent will help you identify:
  - Relevant laws and regulations to your repo
  - Data points
  - CIA of each data point
    - Confidentiality
    - Integrity
    - Availability
  - Threats and vulnerabilities
  - Mitigations
- Outputs
  - Structured JSON output (source of truth) for content
  - Frontend renders the JSON output and can be interacted with directly
  - Save to markdown

Dev features

- Render zod schema as frontend and fill with JSON content
- Render any zod schema as frontend and make the JSON content editable by user
- JSON report content and current conversation state stored in browser localstorage for now

### Frontend view

- Chat sidebar always visible on the right, just one conversation (list of messages)
- repo url at the top
- zod schema display on the left with structured JSON content as input, zod structure as static

## Technologies

- typescript
- pnpm
- react vite webpage frontend
- tailwind css
- node express backend
- docker for backend
- Langchain for LLM interaction
- MCP servers as langchain tools

## LLM Capabilities

LLM conversation:

- Together with user form the JSON content fields

MCP capabilities:

- Web crawl
- Read repo files
