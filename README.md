# Compliance-agent

Focus on this project is to built something that creates value using as much AI tooling as possible.

## Usage

Installation and setup

- Install uvx by running `curl -LsSf https://astral.sh/uv/install.sh | sh`
- `cp ./backend/.env.example ./backend/.env`
- fill in .env file

Usage

- `pnpm dev`
- open `localhost:5173` in the browser

## Features

User features

- Interact through conversations
- Point to your repo
- The agent will help you identify:
  - Relevant laws and regulations to your repo
  - Data points
  - CIA of each data point (rated 1-4)
    - Confidentiality (1-4)
    - Integrity (1-4)
    - Availability (1-4)
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
- One `pnpm dev` command in root to run entire application locally

### Frontend view

- Chat sidebar always visible on the right, just one conversation (list of messages)
- repo url at the top
- zod schema display on the left with structured JSON content as input, zod structure as static

## Technologies

- typescript
- pnpm
- trpc
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
