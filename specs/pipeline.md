# Pipeline

**Source:** `src/server/pipeline.ts`

Central event processing and state management. Connects watchers to the WebSocket relay. Manages per-loop state, health detection, and metadata extraction.

## Requirements

### Loop State

- **WHEN** a new session file is discovered
- **THEN** a `LoopState` is created with:
  - `loopId`: `{vmName}:{sessionBasename}`
  - `status`: `connected`
  - `health`: `running`
  - `currentIteration`: 0
  - `startedAt`: parsed from filename timestamp, or `Date.now()` for UUID filenames
  - Metadata fields: `mode`, `branch`, `model`, `project` (initially null)

### Metadata Extraction

- **WHEN** a line matches `Mode: <word>`
- **THEN** update `state.mode`

- **WHEN** a line matches `Branch: <text>`
- **THEN** update `state.branch`

- **WHEN** a parsed message has `message.model`
- **THEN** update `state.model`

- **WHEN** a parsed message has `type: "system", subtype: "init", cwd: <path>`
- **THEN** extract project name from the last path segment

- **WHEN** session file is under `~/.claude/projects/<encoded>/`
- **THEN** decode project name via greedy filesystem path resolution

### Health Detection

State machine: `running` → `completed` | `errored` | `stale`

- **WHEN** a `result` message arrives (Claude Code session end)
- **THEN** set health to `completed` or `errored` based on `is_error` field

- **WHEN** line matches `Reached max iterations:`
- **THEN** set health to `completed`

- **WHEN** `stop_reason` is `end_turn` or `stop_sequence` with no `tool_use` in content
- **THEN** set health to `completed`

- **WHEN** `stop_reason` is `error`, or structured error fields match API error patterns
- **THEN** set health to `errored`

- **WHEN** a running loop has no activity for 5 minutes
- **THEN** set health to `stale` (or `completed` if last event suggests completion)

- **WHEN** a stale loop receives new activity
- **THEN** revive health back to `running`

### Event Buffering

- **WHEN** events arrive for a loop
- **THEN** they are stored in a rolling buffer of 500 events
- **AND** `tool_paired` events replace their original `tool_call` in-place
