# n8n-agent

An AI-agent workspace for building, operating, and debugging workflows on a self-hosted [n8n](https://n8n.io) instance.

The agent (OpenCode) connects to n8n through the [n8n-mcp](https://github.com/LeonLonsdale/n8n-mcp) MCP server and carries a full n8n skills pack, so it can design, validate, test, and maintain workflows directly — no manual clicking around the n8n editor.

## What's inside

| Path | Purpose |
|---|---|
| `.opencode/opencode.json` | OpenCode MCP config: registers the `community-n8n` server (`npx n8n-mcp`) pointed at the local n8n instance |
| `.opencode/skills/` | 15 n8n skills (routing, node config, expressions, Code nodes, AI agents, error handling, sub-workflows, validation, self-hosting, and more) |
| `.opencode/plugin/n8n-mcp-skills.ts` | Enforcement plugin (OpenCode port of the upstream Claude Code hooks): keeps the router skill in the system prompt, attaches skill reminders to high-risk MCP tool definitions, and routes to the right skills after `validate_workflow` |
| `.openpackage/` | [OpenPackage](https://opencode.ai/docs/openpackage/) manifest pulling the `czlonkowski/n8n-skills` pack (v1.29.0), which syncs the skills and MCP config into `.opencode/` |
| `AGENTS.md` | Agent guidance for this workspace (OpenCode port of the upstream `CLAUDE.md`) |
| `docs/` | Vendored reference docs from [czlonkowski/n8n-skills](https://github.com/czlonkowski/n8n-skills) (installation, usage, development, testing log, Code-node best practices) |
| `evaluations/` | Vendored skill QA scenarios from czlonkowski/n8n-skills |
| `LICENSE` / `NOTICES` / `NOTICES-APACHE-2.0.txt` | Licensing and attribution for the vendored n8n-skills material |
| `README.md` | This file |

## Prerequisites

- A running **n8n instance** (self-hosted or local), reachable at `http://localhost:5678`
- An **n8n API key** with access to the workflows you manage
- Node.js (for `npx n8n-mcp`)

## Setup

1. **Start n8n** and enable the public API, then create an API key for the agent.

2. **Install the API key** where the MCP config expects it:

   ```bash
   mkdir -p ~/.config/opencode
   # paste your key into this file (the config references it via {file:...})
   ```

   Target: `~/.config/opencode/n8n-community-api.key`

3. **Sync the skills pack** (installed via the OpenPackage CLI, `opkg`):

   ```bash
   opkg install
   ```

   This restores the dependency `gh@czlonkowski/n8n-skills` (see `.openpackage/openpackage.yml` / `openpackage.lock`).

4. **Verify the connection** from the agent:

   ```
   /n8n-mcp-tools-expert  →  n8n_health_check
   ```

   A successful health check confirms the MCP server can reach the instance.

## MCP configuration

`.opencode/opencode.json` registers the n8n MCP server:

```jsonc
"mcp": {
  "community-n8n": {
    "type": "local",
    "command": ["npx", "-y", "n8n-mcp"],
    "environment": {
      "MCP_MODE": "stdio",
      "LOG_LEVEL": "error",
      "N8N_API_URL": "http://localhost:5678",
      "N8N_API_KEY": "{file:~/.config/opencode/n8n-community-api.key}",
      "WEBHOOK_SECURITY_MODE": "moderate"
    }
  }
}
```

- **`N8N_API_URL`** — base URL of the n8n instance (change if not local).
- **`N8N_API_KEY`** — read from a local file so the secret never lives in the config.
- **`WEBHOOK_SECURITY_MODE: moderate`** — the agent prompts before triggering webhook-based workflows with side effects.

## Skills pack

The agent loads n8n skills automatically based on the task (routing lives in `.opencode/skills/using-n8n-mcp-skills/SKILL.md`). The pack covers:

- **Build & design** — `n8n-workflow-patterns`, `n8n-node-configuration`, `n8n-subworkflows`
- **Nodes & code** — `n8n-expression-syntax`, `n8n-code-javascript`, `n8n-code-python`, `n8n-code-tool`
- **AI** — `n8n-agents` (agents, LLM chains, RAG, structured output, memory)
- **Reliability** — `n8n-error-handling`, `n8n-validation-expert`, `n8n-binary-and-data`
- **Operations** — `n8n-mcp-tools-expert`, `n8n-multi-instance`, `n8n-self-hosting`

## Enforcement plugin

`.opencode/plugin/n8n-mcp-skills.ts` is the OpenCode port of the upstream [Claude Code hooks](https://github.com/czlonkowski/n8n-skills/tree/main/hooks). It fails open and never blocks a tool call:

1. **Router injection** — appends the `using-n8n-mcp-skills` router skill to the system prompt on every request, and re-asserts it after context compaction, so routing guidance is always present.
2. **Tool-use reminders** — attaches skill reminders to the descriptions of the high-risk n8n-mcp tools (`get_node`, create/update/validate/test workflow, `n8n_instances`, `n8n_manage_credentials`), so the guidance is visible at decision time.
3. **Post-validation routing** — after `validate_workflow` / `n8n_validate_workflow`, parses the validated node types and routes to the skills that own the remaining risks (the antipattern scan validation does NOT catch).

Typecheck with `tsc -p .opencode` (see `.opencode/tsconfig.json`). The plugin's dev deps live in `.opencode/package.json`, which is gitignored — on a fresh clone, run `cd .opencode && npm install` first.

## Working with the agent

- Start with the router skill: it dispatches to the right specialist skill for the task.
- **Validate before activating** — run `validate_workflow` on any changed workflow, then fetch it back to confirm connections.
- **Credentials never go in text fields** — always use n8n's credential system (HTTP Request with the official credential type).
- **Ask before side effects** — webhook tests that trigger real sends/writes are gated by `WEBHOOK_SECURITY_MODE: moderate`.
