/**
 * n8n-mcp-skills enforcement plugin — OpenCode port of the upstream
 * Claude Code hooks (`hooks/hooks.json`) from czlonkowski/n8n-skills.
 *
 * Portions of the reminder texts are adapted from the n8n-io/skills plugin
 * (https://github.com/n8n-io/skills), licensed under Apache License 2.0.
 * See /NOTICES for attribution.
 *
 * Responsibilities (mirrors the upstream hooks):
 *
 *  1. Router injection  (SessionStart analog)
 *     Appends the `using-n8n-mcp-skills` router skill to the system prompt on
 *     every request, so routing guidance is always present, and re-asserts it
 *     after context compaction. No dedup markers needed: the system prompt is
 *     rebuilt per request, so the router can never go stale.
 *
 *  2. Tool-use reminders (PreToolUse analog)
 *     Appends skill reminders to the descriptions of high-risk n8n-mcp tools
 *     (`get_node`, create/update/validate/test workflow, `n8n_instances`,
 *     `n8n_manage_credentials`) so the guidance is present at decision time.
 *     Unlike the upstream one-shot-per-session markers, the reminder is always
 *     attached to the tool definition — strictly more coverage.
 *
 *  3. Post-validation routing (PostToolUse analog)
 *     After `validate_workflow` / `n8n_validate_workflow`, parses the validated
 *     node types out of the call args and routes to the skills that own the
 *     remaining risks (the antipattern scan validation does NOT catch).
 *
 * Fails open: never blocks, aborts, or throws on a tool call.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "@opencode-ai/plugin";

const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url));
const ROUTER_PATH = join(PLUGIN_DIR, "../skills/using-n8n-mcp-skills/SKILL.md");
const ROUTER_MARKER = "using-n8n-mcp-skills";
const ENFORCEMENT_MARKER = "n8n-mcp-skills enforcement";

// --- Router skill content, read once at load time. Fail open on any error. ---
let routerContent: string = "";
try {
  routerContent = readFileSync(ROUTER_PATH, "utf8");
} catch {
  // Router unavailable — the plugin degrades to tool reminders only.
}

/**
 * Normalize an OpenCode tool name to its base n8n tool name.
 * OpenCode names MCP tools `mcp__<server>__<tool>` (e.g.
 * `mcp__community-n8n__get_node`); plain tools arrive as just `<tool>`.
 */
function toolBase(tool: string): string {
  return tool.replace(/^mcp__[^_]+__/, "");
}

// --- PreToolUse analog: reminders appended to high-risk tool definitions ------
// Keyed by base tool name. These texts mirror the upstream pre-tool-use hooks.

const TOOL_REMINDERS: Record<string, string> = {
  get_node: `Before configuring this node, invoke the n8n-node-configuration skill via the Skill tool. Configuration is operation-aware: required fields depend on the resource/operation pair, and displayOptions control which fields are even visible. Never assume parameter names; confirm them against the definition you're about to fetch. For interpreting validation results afterward, n8n-validation-expert.

If the node you are looking up is a HIGH-RISK type, stop and invoke the matching specialist skill first (routing in the router skill):
- Set / Edit Fields — n8n-expression-syntax: a Set feeding only ONE downstream consumer should be deleted and its expressions inlined into the consumer's parameter slots. It earns its place only for 2+ consumers of the same derived value, or as the final return-shape node of a sub-workflow.
- Code — n8n-code-javascript: expression first, then an arrow function inside Edit Fields, then a Code node; Python only if the user asked (n8n-code-python); an AI-agent-callable tool is a different runtime (n8n-code-tool). Many Code-node jobs have a native node (Crypto, XML, HTTP pagination) or belong in an expression.
- Merge — n8n-node-configuration: defaults to 2 inputs; with 3+ wires set numberOfInputs explicitly or the extra sources silently drop. Input-index pairing is easy to wire backwards.
- splitInBatches (Loop Over Items) — n8n-code-javascript + n8n-workflow-patterns: usually not needed (connect source to consumer); output 0 is DONE (fires once at end), output 1 is LOOP (fires per batch) — easy to wire backwards.
- DateTime — n8n-expression-syntax: date math/formatting usually works inline with Luxon at the consumer field; reach for the node only when an inline expression can't express it.
- Data Table — n8n-node-configuration + n8n-workflow-patterns: id/createdAt/updatedAt are system-managed; column types are primitives only (string/number/boolean/date — use JSON.stringify/parse for nested data); map fields DIRECTLY in the Insert node's per-column slots, no Set node before it.
- LangChain Agent (nodes-langchain.agent) — n8n-agents: tool names/descriptions ARE part of the prompt; model/memory/tools/outputParser slots, structured output + autoFix, memory/sessionId all have traps. Custom Code tools on the agent: n8n-code-tool.`,

  n8n_create_workflow: `Before creating: invoke n8n-workflow-patterns (pick the right architecture — webhook / HTTP API / database / AI agent / scheduled / batch — name nodes for what they do, add sticky notes capturing the why) and n8n-subworkflows (search existing workflows with n8n_list_workflows and reuse a sub-workflow before duplicating logic) via the Skill tool.`,

  n8n_update_partial_workflow: `Before updating: after applying the operations, verify the connections object with n8n_get_workflow. validate_workflow does not catch every multi-input wiring trap. For Merge node specifics (numberOfInputs, input index off-by-one) see n8n-node-configuration; for wiring that survives into runtime see n8n-validation-expert; for per-node error outputs (onError + wiring main[1]) see n8n-error-handling. Invoke them via the Skill tool.`,

  n8n_update_full_workflow: `Before updating: after applying the operations, verify the connections object with n8n_get_workflow. validate_workflow does not catch every multi-input wiring trap. For Merge node specifics (numberOfInputs, input index off-by-one) see n8n-node-configuration; for wiring that survives into runtime see n8n-validation-expert; for per-node error outputs (onError + wiring main[1]) see n8n-error-handling. Invoke them via the Skill tool.`,

  validate_workflow: `Before validating, run the antipattern scan node-by-node (invoke n8n-validation-expert and n8n-workflow-patterns via the Skill tool): Set nodes feeding only 1 consumer should be inlined; Code nodes doing pure field shaping should be Edit Fields with arrow functions; Merges with 3+ wires need numberOfInputs set explicitly; $json.x in branchy workflows should be $('Node').item.json.x; DateTime nodes should be Luxon expressions. validate_workflow does not catch any of these; only the manual scan does. Validation passing means the JSON is well-formed, not that the workflow is correct.`,

  n8n_validate_workflow: `Before validating, run the antipattern scan node-by-node (invoke n8n-validation-expert and n8n-workflow-patterns via the Skill tool): Set nodes feeding only 1 consumer should be inlined; Code nodes doing pure field shaping should be Edit Fields with arrow functions; Merges with 3+ wires need numberOfInputs set explicitly; $json.x in branchy workflows should be $('Node').item.json.x; DateTime nodes should be Luxon expressions. validate_workflow does not catch any of these; only the manual scan does. Validation passing means the JSON is well-formed, not that the workflow is correct.`,

  n8n_test_workflow: `Before testing: invoke n8n-validation-expert (interpret what the run surfaces) and n8n-error-handling (are error branches wired? caller faults 4xx, your faults 5xx) via the Skill tool. n8n_test_workflow executes real nodes — Code, HTTP Request, database writes, Slack/email sends, and sub-workflow calls all fire for real. Ask the user before running if any node has user-visible side effects, and tell them which nodes ran live afterward.`,

  n8n_instances: `Before listing or switching instances: invoke the n8n-multi-instance skill via the Skill tool. Every n8n tool routes to the currently-targeted instance — there is no per-call instance argument, and a wrong target is usually silent. Switch in its OWN turn (never batch a switch with a dependent call). Verify current with n8n_instances list immediately before any credential create/update/delete — the server fail-closes only the ambiguous case (INSTANCE_AMBIGUOUS), not an explicit wrong switch. An unexpected NOT_FOUND is almost always a wrong-instance misroute, not a deletion: verify and retry, do not recreate.`,

  n8n_manage_credentials: `Before a credential operation: invoke n8n-mcp-tools-expert via the Skill tool. Credentials hold live secrets — use the credential system and getSchema, never inline tokens into text fields. If this account has multiple n8n instances (the n8n_instances tool is present), ALSO invoke n8n-multi-instance: a credential create/update/delete routes to the currently-selected instance. The server fail-closes only the AMBIGUOUS case with INSTANCE_AMBIGUOUS (this session never switched; switch on this session, then retry) — an explicit switch to the wrong instance still writes the secret there, so verify current (n8n_instances list) immediately before the write.`,
};

// --- PostToolUse analog: routing after validate_workflow ---------------------

const VALIDATE_TOOLS = new Set(["validate_workflow", "n8n_validate_workflow"]);

/** Extract long-form node types from a validate_workflow call's args. */
function nodeTypesFromArgs(args: unknown): string[] {
  const a = (args ?? {}) as { workflow?: { nodes?: unknown }; nodes?: unknown };
  const nodes = Array.isArray(a.workflow?.nodes) ? a.workflow.nodes : Array.isArray(a.nodes) ? a.nodes : [];
  return nodes
    .map((n: unknown) => ((n as { type?: unknown })?.type ?? "") as string)
    .filter((t: string) => t.length > 0);
}

/** Build the post-validation routing message (port of post-tool-use/validate-workflow.sh). */
function buildValidationRouting(args: unknown): string {
  const types = nodeTypesFromArgs(args);

  // --- No node data (by-id validation or empty payload): generic gate ---
  if (types.length === 0) {
    return `[validate_workflow returned. Validation is necessary, not sufficient.] No node JSON was available to analyze. If this workflow is non-trivial, invoke n8n-validation-expert and n8n-workflow-patterns via the Skill tool and run the antipattern scan before activating.`;
  }

  const nodeCount = types.length;
  const hasType = (t: string) => types.includes(t);
  const hasSuffix = (re: RegExp) => types.some((t) => re.test(t));

  const HAS_SET = hasType("n8n-nodes-base.set");
  const HAS_CODE = hasType("n8n-nodes-base.code");
  const HAS_MERGE = hasType("n8n-nodes-base.merge");
  const HAS_LOOP = hasType("n8n-nodes-base.splitInBatches");
  const HAS_DATETIME = hasType("n8n-nodes-base.dateTime");
  const HAS_DATATABLE = hasType("n8n-nodes-base.dataTable");
  const HAS_SUBWF_TRIGGER = hasType("n8n-nodes-base.executeWorkflowTrigger");
  const HAS_WEBHOOK = hasType("n8n-nodes-base.webhook");
  const HAS_HTTP = hasType("n8n-nodes-base.httpRequest");
  const HAS_RESPOND = hasType("n8n-nodes-base.respondToWebhook");
  const HAS_SCHEDULE = hasType("n8n-nodes-base.scheduleTrigger");
  const HAS_AGENT = hasSuffix(/nodes-langchain\.agent$/);
  const HAS_CHAT_TRIGGER = hasSuffix(/langchain\.chatTrigger$/);
  const HAS_DOLLAR_JSON = /\$json\./.test(JSON.stringify(args));

  // Detected summary line
  const detectedParts: string[] = [];
  if (HAS_SET) detectedParts.push("Set");
  if (HAS_CODE) detectedParts.push("Code");
  if (HAS_MERGE) detectedParts.push("Merge");
  if (HAS_LOOP) detectedParts.push("Loop");
  if (HAS_DATETIME) detectedParts.push("DateTime");
  if (HAS_SUBWF_TRIGGER) detectedParts.push("SubWorkflowTrigger");
  if (HAS_DATATABLE) detectedParts.push("DataTable");
  if (HAS_AGENT) detectedParts.push("Agent");
  if (HAS_WEBHOOK) detectedParts.push("Webhook");
  if (HAS_HTTP) detectedParts.push("HttpRequest");
  if (HAS_RESPOND) detectedParts.push("RespondToWebhook");
  if (HAS_SCHEDULE) detectedParts.push("Schedule");
  const detected = detectedParts.length > 0 ? ` ${detectedParts.join(" ")}` : " (none of the high-risk node types)";

  // Consolidated n8n-expression-syntax reasons
  const exprReasons: string[] = [];
  if (HAS_SET) exprReasons.push("Set inline antipattern");
  if (HAS_DATETIME) exprReasons.push("DateTime -> Luxon");
  if (HAS_DOLLAR_JSON) exprReasons.push("$json refs in branchy flow");
  const exprReasonsText = exprReasons.join(", ");

  const suggestions: string[] = [];
  if (HAS_MERGE) {
    suggestions.push("n8n-node-configuration (Merge: numberOfInputs vs wire count, input index off-by-one)");
  }
  if (exprReasonsText) {
    suggestions.push(`n8n-expression-syntax (${exprReasonsText})`);
  }
  if (HAS_CODE) {
    suggestions.push(
      "n8n-code-javascript (Code present: review against expression / Edit Fields alternatives; Python -> n8n-code-python; agent tool -> n8n-code-tool)",
    );
  }
  if (HAS_LOOP || HAS_HTTP) {
    suggestions.push("n8n-code-javascript + n8n-workflow-patterns (Loop Over Items / HTTP pagination & batching)");
  }
  if (HAS_SUBWF_TRIGGER) {
    suggestions.push("n8n-subworkflows (sub-workflow trigger: Define-Below input mode + return-shape rules)");
  }
  if (HAS_DATATABLE) {
    suggestions.push(
      "n8n-node-configuration + n8n-workflow-patterns (Data Table: system columns, primitive-only types, map-in-Insert rule)",
    );
  }
  if (HAS_HTTP || HAS_WEBHOOK || HAS_RESPOND) {
    suggestions.push("n8n-mcp-tools-expert (auth surface present: use the credential system, never inline tokens)");
  }
  if (HAS_WEBHOOK || HAS_RESPOND || HAS_SCHEDULE || HAS_CHAT_TRIGGER || HAS_AGENT) {
    suggestions.push(
      "n8n-error-handling (unattended / webhook / agent workflow: wire an error branch on every fallible node; 4xx/5xx response shapes)",
    );
  }
  if (nodeCount > 6) {
    suggestions.push("n8n-workflow-patterns (>6 nodes: architecture review, sticky notes, naming)");
  }
  if (HAS_AGENT) {
    suggestions.push(
      "n8n-agents (LangChain Agent: tool names/descriptions are part of the prompt; structured output + autoFix; memory/sessionId)",
    );
  }

  const header = `[validate_workflow returned. Validation is necessary, not sufficient.]\nWorkflow analyzed: ${nodeCount} node(s); detected:${detected}.\n`;

  if (suggestions.length === 0) {
    return `${header}\nNo high-risk patterns surfaced. If anything here is non-trivial, invoke n8n-validation-expert and n8n-workflow-patterns via the Skill tool and run the antipattern scan before activating.`;
  }

  const bullets = suggestions.map((s) => `- ${s}`).join("\n");
  return `${header}\nIf any of these skills are not already in your context, invoke them via the Skill tool:\n${bullets}\n\nThis is the gate. Walk these BEFORE activating the workflow. Validation passing means the JSON is well-formed; it does NOT mean the workflow is correct.`;
}

// --- Plugin ------------------------------------------------------------------

export const N8nMcpSkillsPlugin: Plugin = async () => {
  return {
    /**
     * Router injection (SessionStart analog): keep the router skill in the
     * system prompt on every request. The guard prevents double-append if the
     * hook fires more than once for the same prompt build.
     */
    "experimental.chat.system.transform": async (_input, output) => {
      if (!routerContent) return;
      const alreadyPresent = output.system.some((s) => s.includes(ROUTER_MARKER));
      if (!alreadyPresent) {
        output.system.push(routerContent);
      }
    },

    /**
     * Compaction reinforcement: re-assert the router in the compaction prompt
     * so skill-awareness survives context compression (the upstream hook
     * re-fires on `compact` for the same reason).
     */
    "experimental.session.compacting": async (_input, output) => {
      if (!routerContent) return;
      output.context.push(
        `Remember the n8n-mcp-skills pack: invoke the ${ROUTER_MARKER} router skill via the Skill tool for any n8n/workflow/node/automation task, then follow its routing to the specialist skill.`,
      );
    },

    /**
     * PreToolUse analog: attach reminders to high-risk tool descriptions so
     * the guidance is present at decision time. Only listed tools are touched.
     */
    "tool.definition": async (input, output) => {
      const base = toolBase(input.toolID);
      const reminder = TOOL_REMINDERS[base];
      if (!reminder) return;
      if (!output.description.includes(ENFORCEMENT_MARKER)) {
        output.description = `${output.description}\n\n${reminder}\n\n(${ENFORCEMENT_MARKER})`;
      }
    },

    /**
     * PostToolUse analog: after validate_workflow, append the skill-routing
     * analysis to the tool result the model reads. Fires every call (no dedup),
     * matching the upstream post hook.
     */
    "tool.execute.after": async (input, output) => {
      if (!VALIDATE_TOOLS.has(toolBase(input.tool))) return;
      try {
        const routing = buildValidationRouting(input.args);
        if (routing) {
          output.output = `${output.output}\n\n${routing}`;
        }
      } catch {
        // Never break the tool result on a parse failure.
      }
    },
  };
};

export default N8nMcpSkillsPlugin;
