# Event Parser

**Source:** `src/lib/parser.ts`

Parses raw JSONL lines into typed `MonitorEvent` objects. Pairs tool calls with results. Generates human-readable summaries.

## Requirements

### JSONL Line Parsing

- **WHEN** a line has `type: "assistant"` with `content[].type: "tool_use"`
- **THEN** emit `tool_call` event with: tool name, input args, tool_use_id, model, session_id, summary

- **WHEN** a line has `type: "user"` with `content[].type: "tool_result"`
- **THEN** emit `tool_result` event with: tool_use_id, duration_ms, result summary

- **WHEN** a line has `type: "assistant"` with `content[].type: "text"`
- **THEN** emit `thinking` event with: excerpt (first 120 chars), full text

- **WHEN** a non-JSON line matches `=+ LOOP \d+ =+`
- **THEN** emit `iteration` event with the iteration number

- **WHEN** a line is not valid JSON and not a known marker
- **THEN** emit `raw` event with the line content (no crash)

### Tool Call/Result Pairing

- **WHEN** a `tool_result` arrives with a `tool_use_id` matching a pending `tool_call`
- **THEN** merge them into a `tool_paired` event with call + result + duration
- **AND** replace the original `tool_call` in the event buffer

- **WHEN** a `tool_call` has no matching result after 60 seconds
- **THEN** it remains as a pending `tool_call` in the buffer
- **AND** is pruned from the pairer's pending map

### Narrative Summaries

Tool-specific summaries for `tool_call` events:

| Tool | Summary format |
|------|---------------|
| Glob | `Searching "{pattern}"` |
| Read | `Reading {basename}` |
| Edit | `Editing {basename}` |
| Write | `Creating {basename}` |
| Grep | `Searching for "{pattern}"` |
| Bash | `Running: {truncated command}` |
| Agent/Task | `Spawning {model} subagent: {description}` |
| WebFetch | `Fetching {hostname}` |
| WebSearch | `Searching web: {query}` |
| Default | `{toolName}({truncated args})` |

Tool result summaries include `numFiles`, `exitCode`, and `durationMs` when available.
