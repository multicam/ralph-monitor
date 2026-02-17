## ADDED Requirements

### Requirement: JSONL Line Parsing

Each line from the JSONL file is parsed into a typed event.

#### Scenario: Parse assistant tool_use message

- **WHEN** a line has `type: "assistant"` and content contains `type: "tool_use"`
- **THEN** emit an event of type `tool_call`
- **AND** include: tool name, input args, tool_use id, model, session_id
- **AND** generate a human-readable summary (e.g., "Searching src/**/*.ts")

#### Scenario: Parse user tool_result message

- **WHEN** a line has `type: "user"` and content contains `type: "tool_result"`
- **THEN** emit an event of type `tool_result`
- **AND** include: tool_use_id (for pairing), duration_ms, result summary
- **AND** generate a summary (e.g., "13 files found (80ms)")

#### Scenario: Parse assistant text message

- **WHEN** a line has `type: "assistant"` and content contains `type: "text"`
- **THEN** emit an event of type `thinking`
- **AND** include: truncated excerpt (first 120 chars), full text available on expand

#### Scenario: Parse loop boundary

- **WHEN** a non-JSON line matches `=+ LOOP \d+ =+`
- **THEN** emit an event of type `iteration`
- **AND** include: iteration number, timestamp

#### Scenario: Parse non-JSON lines gracefully

- **WHEN** a line is not valid JSON and not a known marker
- **THEN** emit an event of type `raw` with the line content
- **AND** do not crash or stop processing

### Requirement: Tool Call/Result Pairing

Tool calls and their results are paired into unified events for display.

#### Scenario: Pair a tool_result with its tool_call

- **WHEN** a `tool_result` event arrives with a `tool_use_id`
- **THEN** find the pending `tool_call` with matching `tool_use_id`
- **AND** merge them into a single `tool_paired` event with call + result + duration

#### Scenario: Unpaired tool_call after timeout

- **WHEN** a `tool_call` has no matching `tool_result` within 60 seconds
- **THEN** mark it as `pending` (still running)
- **AND** display it with a spinner/elapsed timer in the UI

### Requirement: Narrative Summaries

Each event includes a human-readable summary derived from the raw data.

#### Scenario: Tool-specific summaries

- **WHEN** a `tool_call` event is created
- **THEN** the summary is tool-aware:
  - Glob: "Searching `{pattern}`"
  - Read: "Reading `{basename(file_path)}`"
  - Edit: "Editing `{basename(file_path)}`"
  - Write: "Creating `{basename(file_path)}`"
  - Grep: "Searching for `{pattern}`"
  - Bash: "Running: `{truncated command}`"
  - Task: "Spawning {model} subagent: {description}"
  - WebFetch: "Fetching {hostname(url)}"
  - Default: "{tool_name}({truncated args})"

#### Scenario: Tool result summaries

- **WHEN** a `tool_result` event is created
- **THEN** the summary includes result metadata where available:
  - Glob result: "{numFiles} files found ({duration}ms)"
  - Read result: "{lines} lines ({duration}ms)"
  - Bash result: "exit {code} ({duration}ms)"
  - Default: "completed ({duration}ms)"
