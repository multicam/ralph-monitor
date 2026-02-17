## 1. Project Scaffolding

- [x] 1.1 Initialize bun project with `bun init`, add dependencies: ssh2, ws, svelte, sveltekit, yaml
- [x] 1.2 Create directory structure: `src/server/`, `src/lib/`, `src/frontend/`
- [x] 1.3 Configure TypeScript with strict mode, shared tsconfig for lib
- [x] 1.4 Create `ralph-monitor.yaml` config file with VM connection schema

## 2. Shared Types & Parser (`src/lib/`)

- [x] 2.1 Define event types: `ToolCallEvent`, `ToolResultEvent`, `ThinkingEvent`, `IterationEvent`, `RawEvent`, `ToolPairedEvent`
- [x] 2.2 Define VM types: `VmConfig`, `VmStatus`, `VmState`
- [x] 2.3 Define WebSocket message types: `SnapshotMessage`, `EventMessage`, `VmStatusMessage`
- [x] 2.4 Implement JSONL line parser: JSON.parse with fallback to raw/marker detection
- [x] 2.5 Implement narrative summary generator (tool-specific human-readable strings)
- [x] 2.6 Implement tool call/result pairing state machine
- [x] 2.7 Write tests for parser: valid JSONL, non-JSON lines, loop markers, malformed input
- [x] 2.8 Write tests for narrative summaries: each tool type, edge cases

## 3. JSONL Capture (`loop.sh` modification)

- [x] 3.1 Add `mkdir -p /tmp/ralph` to loop.sh startup
- [x] 3.2 Add `tee` pipe to claude invocation: `| tee -a /tmp/ralph/<timestamp>-<mode>.jsonl`
- [ ] 3.3 Verify terminal output is unchanged with tee in place
- [ ] 3.4 Verify JSONL file contains both JSON lines and loop markers

## 4. SSH Manager (`src/server/ssh-manager.ts`)

- [x] 4.1 Implement `SshManager` class: connect to VM via ssh2, manage connection lifecycle
- [x] 4.2 Implement JSONL file discovery: list `/tmp/ralph/`, find most recent `.jsonl`
- [x] 4.3 Implement `tail -f` over SSH exec channel, emit lines as events
- [x] 4.4 Implement new session detection: watch for newer `.jsonl` files, switch tail
- [x] 4.5 Implement reconnection with exponential backoff (1s, 2s, 4s... max 30s)
- [x] 4.6 Implement idle VM handling: poll `/tmp/ralph/` every 5s when no files exist

## 5. Event Pipeline (`src/server/pipeline.ts`)

- [x] 5.1 Wire SSH manager output through JSONL parser and narrative summarizer
- [x] 5.2 Implement circular event buffer (500 events per VM)
- [x] 5.3 Maintain current VM state: iteration, mode, branch, model, connection status
- [x] 5.4 Emit parsed events to WebSocket relay

## 6. WebSocket Server (`src/server/ws-server.ts`)

- [x] 6.1 Implement WebSocket server (ws library on same HTTP server as frontend)
- [x] 6.2 On client connect: send snapshot (VM states + last 100 events per VM)
- [x] 6.3 On new event: broadcast to all connected clients
- [x] 6.4 On VM status change: broadcast status update

## 7. Frontend — Layout & VM Cards (`src/frontend/`)

- [x] 7.1 Set up SvelteKit app with single dashboard route
- [x] 7.2 Implement WebSocket client store (connect, reconnect, parse messages)
- [x] 7.3 Implement VM state store (reactive map of VM id → state + events)
- [x] 7.4 Build VM card component: name, status dot, mode, iteration, model, branch, uptime
- [x] 7.5 Build grid layout: responsive grid of VM cards (2-5 cards)

## 8. Frontend — Live Feed & Detail

- [x] 8.1 Build event feed component: scrolling list of parsed events per VM card
- [x] 8.2 Implement auto-scroll (scroll to top on new event, unless user has scrolled up)
- [x] 8.3 Build event row component: icon, summary, duration badge, timestamp
- [x] 8.4 Build pending tool call indicator: pulsing dot with elapsed timer
- [x] 8.5 Build iteration separator: horizontal line with "Iteration N" label
- [x] 8.6 Build expandable detail view: click event to see raw data/full text
- [x] 8.7 Build aggregate status bar: tool calls/min, commits/hour, error count

## 9. Integration & Polish

- [x] 9.1 Wire backend and frontend together: dev server with WebSocket proxy
- [ ] 9.2 Test end-to-end: start monitor, connect to a real VM with active loop
- [x] 9.3 Handle edge cases: VM reboot (files disappear), loop restart, monitor restart
- [x] 9.4 Add basic styling: dark theme, monospace fonts, density-appropriate spacing
