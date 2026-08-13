# Project Memory

Standing user preferences for this repository. Loaded into every agent session via
`instructions` in `.opencode/opencode.json`.

## Standing Rules

- **This repo is "just a tool"** — an OpenCode agent workspace for building n8n
  workflows. It documents only tooling and configuration (MCP setup, skills pack,
  enforcement plugin, OpenPackage manifest, licensing).
- **Never store workflow-specific or instance-specific content here.** Forbidden:
  descriptions of any workflows running on the n8n instance (names, pipelines,
  stages, node details), instance state ("what's actually running", active/inactive),
  business or lead data, and git history/remote details.
- **When asked to describe, report on, or document this repo** — cover only tooling
  and configuration. If asked about workflows on the instance, the repo does not
  track them.

## Context

- User requested a report about this repo, then explicitly rejected workflow/pipeline
  content ("it is just a tool") and asked to keep only tooling and configuration.
- User then asked to strip all such content from the project and to add a standing
  rule so it never reappears (mirrored in `AGENTS.md` under "Working in This
  Repository").
