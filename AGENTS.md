# AGENTS.md

This file provides guidance to AI agents (OpenCode) working in this repository.

## Project Overview

This repo is an **OpenCode agent workspace** for a self-hosted **n8n** instance. The
agent connects to n8n through the [n8n-mcp](https://github.com/czlonkowski/n8n-mcp)
MCP server (`community-n8n` in `.opencode/opencode.json`) and carries the
**n8n-mcp-skills pack** (vendored from [czlonkowski/n8n-skills](https://github.com/czlonkowski/n8n-skills),
MIT / Apache-2.0 material — see `LICENSE` and `NOTICES`).

**Purpose**: expert guidance on building flawless n8n workflows via the n8n-mcp MCP
tools.

**Architecture**:
- **n8n-mcp MCP Server**: provides data access (nodes, validation, templates, workflow management)
- **Skills** (`.opencode/skills/`): expert guidance on HOW to use the MCP tools
- **Plugin** (`.opencode/plugin/n8n-mcp-skills.ts`): the enforcement layer — always-on router + tool-use reminders (OpenCode port of the upstream Claude Code hooks)
- **Together**: an expert workflow builder with progressive disclosure

## Repository Layout

```
n8n-agent/
├── README.md                  # Project overview (workflows, setup, usage)
├── AGENTS.md                  # This file
├── docs/                      # Vendored reference docs (czlonkowski/n8n-skills)
├── evaluations/               # Vendored skill QA scenarios (czlonkowski/n8n-skills)
├── LICENSE                    # MIT — covers vendored n8n-skills material
├── NOTICES                    # Attribution for Apache-2.0 material (n8n-io/skills)
├── NOTICES-APACHE-2.0.txt     # Apache-2.0 license text (see NOTICES)
├── .opencode/
│   ├── opencode.json          # MCP config: community-n8n (npx n8n-mcp → localhost:5678)
│   ├── package.json           # Plugin dev deps (@opencode-ai/plugin, @types/node) — gitignored, recreated by npm install
│   ├── tsconfig.json          # Typecheck config for the plugin (tsc -p .opencode)
│   ├── plugin/
│   │   └── n8n-mcp-skills.ts  # Enforcement plugin — OpenCode port of the upstream hooks
│   └── skills/                # The 15-skill n8n-mcp-skills pack (kept in sync with upstream)
└── .openpackage/              # OpenPackage manifest (pulls czlonkowski/n8n-skills)
```

**Enforcement layer (`.opencode/plugin/n8n-mcp-skills.ts`):** the OpenCode port of the
upstream hooks. It (1) appends the `using-n8n-mcp-skills` router to the system prompt
on every request, (2) appends skill reminders to the descriptions of high-risk MCP
tools (`get_node`, create/update/validate/test workflow, `n8n_instances`,
`n8n_manage_credentials`) so the guidance is present at decision time, and (3) after
`validate_workflow`, parses the validated node types and routes to the skills that own
the remaining risks. It fails open and never blocks a tool call.

Upstream hook mapping (Claude Code → OpenCode plugin hooks):
- `SessionStart` (router injection; re-fires on compact) → `experimental.chat.system.transform` + `experimental.session.compacting`
- `PreToolUse` (per-tool reminders) → `tool.definition` (reminders attached to the tool descriptions)
- `PostToolUse` (post-validate routing) → `tool.execute.after`

## The Skills (all in `.opencode/skills/`)

### 1. n8n Expression Syntax
- Teaches correct n8n expression syntax ({{}} patterns)
- Covers common mistakes and fixes
- Critical gotcha: Webhook data under `$json.body`

### 2. n8n MCP Tools Expert (HIGHEST PRIORITY)
- Teaches how to use n8n-mcp MCP tools effectively
- Covers unified tools: `get_node`, `validate_node`, `search_nodes`
- Workflow management with `n8n_update_partial_workflow`
- `n8n_deploy_template`, `n8n_workflow_versions`, `activateWorkflow`

### 3. n8n Workflow Patterns
- 5 proven patterns: webhook, HTTP API, database, AI, scheduled

### 4. n8n Validation Expert
- Interprets validation errors and guides fixing; false positives; validation loops
- Auto-fix with `n8n_autofix_workflow`

### 5. n8n Node Configuration
- Operation-aware node configuration; property dependencies; common patterns

### 6. n8n Code JavaScript
- JavaScript in n8n Code nodes; data access patterns, `$helpers`, DateTime

### 7. n8n Code Python
- Python in n8n Code nodes; limitations awareness (no external libraries)

### 8. n8n Code Tool
- The AI-agent-callable Custom Code Tool (`@n8n/n8n-nodes-langchain.toolCode`)
- Returns a **string** (not `[{json:{...}}]`); `$fromAI()` not available; different sandbox

### 9. n8n Error Handling
- Per-node error outputs (`onError: continueErrorOutput` + wiring `main[1]`), `retryOnFail`
- 4xx/5xx response shapes; `responseCode` defaults to 200 even on error; Error Trigger workflows

### 10. n8n Binary & Data
- `$binary` vs `$json`; Merge to preserve binary; agent-tool binary boundary; CDN for chat images

### 11. n8n Sub-workflows
- Execute Workflow Trigger Define-Below typed inputs; `mode: all` vs `each` + `waitForSubWorkflow`
- Verb-first prefix naming; stateless vs stateful; N+1 split-by-input-shape

### 12. n8n AI Agents
- Agent vs LLM Chain vs Text Classifier; model/memory/tools/outputParser slots; `$fromAI`
- Tool names/descriptions as prompt; structured output + autoFix; memory/sessionId; human review

### 13. n8n Multi-Instance
- `n8n_instances` `list`/`switch`; per-session target binding
- Verify `current` before credential writes (`INSTANCE_AMBIGUOUS` fail-closes only the ambiguous case); NOT_FOUND ≈ wrong instance, not deletion

### 14. n8n Self-Hosting (deployment/ops, not workflow-building)
- Deploy production self-hosted n8n to a fresh Linux VM (Docker Compose + Caddy, single/queue mode)
- Day-2 update/backup/restore

### Router: using-n8n-mcp-skills (always-on)
- Loaded into the system prompt by the plugin on every request
- Routes to the right skill, summarizes every n8n-mcp tool, states the cross-cutting rules

## Key MCP Tools

### Node Discovery
- `search_nodes` — find nodes by keyword
- `get_node` — unified node info (detail levels: minimal/standard/full; modes: info/docs/search_properties/versions)

### Validation
- `validate_node` — unified validation (modes: minimal/full; profiles: runtime/ai-friendly/strict)
- `validate_workflow` — complete workflow validation

### Workflow Management
- `n8n_create_workflow`, `n8n_update_partial_workflow` (19 op types incl. `patchNodeField`, `activateWorkflow`, `transferWorkflow`), `n8n_update_full_workflow`
- `n8n_validate_workflow` (by ID), `n8n_autofix_workflow`, `n8n_deploy_template`, `n8n_workflow_versions`
- `n8n_test_workflow`, `n8n_executions`, `n8n_list_workflows`, `n8n_get_workflow`, `n8n_delete_workflow`

### Data, Credentials, Security
- `n8n_manage_datatable` — data tables and rows (CRUD, filtering, dry-run)
- `n8n_manage_credentials` — credential CRUD + `getSchema`
- `n8n_audit_instance` — security audit (built-in 5 categories + deep scan)

### Templates & Guides
- `search_templates` (keyword/by_nodes/by_task/by_metadata), `get_template`
- `tools_documentation` — meta-docs; the AI agent workflow guide: `tools_documentation({topic: "ai_agents_guide", depth: "full"})`

## Important Patterns

### Most Common Tool Usage Pattern
```
search_nodes → get_node
```

### Most Common Validation Pattern
```
n8n_update_partial_workflow → n8n_validate_workflow
```

### Most Used Tool
```
n8n_update_partial_workflow
```

## Working in This Repository

- **Repo scope — tooling & configuration only**: this repo documents the agent
  tooling (MCP config, skills pack, plugin, OpenPackage manifest) — never store or
  commit workflow-specific content. Forbidden: descriptions of workflows running on
  the instance (names, pipelines, stages, node details), instance state
  (active/inactive, "what's actually running"), business/lead data, and git
  history/remote details. When asked to describe or document this repo, cover only
  tooling and configuration.
- **Start with the router**: invoke `using-n8n-mcp-skills` (via the Skill tool) on any
  n8n task — the plugin also keeps it in the system prompt.
- **Validate AND verify before activating**: run `validate_workflow` (or
  `n8n_validate_workflow` by ID), then `n8n_get_workflow` to inspect `connections`.
  Validation passing means the JSON is well-formed — not that the workflow is correct.
- **Secrets never go in text fields**: tokens/API keys/passwords always through the
  n8n credential system (HTTP Request node + official credential type).
- **Ask before side effects**: `n8n_test_workflow` runs real nodes (Code, HTTP, DB
  writes, sends, sub-workflow calls) — ask the user first when side effects exist.
- **Antipattern scan before activating**: Set feeding ≤1 consumer → inline the
  expression; Code doing pure field shaping → Edit Fields; Merge 3+ wires →
  `numberOfInputs` set explicitly; `$json.x` in branchy flows → `$('Node').item.json.x`;
  DateTime node → Luxon expression.

## Distribution

The skills pack is available upstream as:
1. **GitHub Repository**: https://github.com/czlonkowski/n8n-skills
2. **Claude Code Plugin**: `npm install @anthropic/claude-code-plugin-n8n-skills`
3. This repo vendors the pack and ports its enforcement layer to OpenCode.

## Credits

Conceived by Romuald Członkowski — [www.aiadvisors.pl/en](https://www.aiadvisors.pl/en).
Part of the n8n-mcp project. Adapted for OpenCode in this repository.

## License

The vendored n8n-skills material is MIT (see `LICENSE`); portions adapted from
n8n-io/skills are Apache-2.0 (see `NOTICES`).
