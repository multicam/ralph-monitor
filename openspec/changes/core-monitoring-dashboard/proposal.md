## Why

Ralph loops run Claude Code in headless mode on Proxmox VMs, outputting stream-json JSONL to stdout. Today this output scrolls by in separate SSH terminal windows and is never saved. There's no way to see what multiple loops are doing at a glance, no persistent history, and no human-readable interpretation of the raw tool call traffic.

ralph-monitor turns that ephemeral JSONL stream into a live web dashboard — showing what each loop is doing right now, in plain language, across all VMs simultaneously.

## What Changes

- Modify `loop.sh` to tee JSONL output to a file alongside stdout
- Build a backend that SSH-tails those JSONL files from each VM in real-time
- Parse raw JSONL into structured, human-readable events (tool calls, results, thinking, commits, iterations)
- Serve a Svelte 5 web frontend showing a live feed per VM with aggregated status
- WebSocket push from backend to frontend for real-time updates

## Non-Goals

- Managing/starting/stopping loops from the UI (v2 — monitor only for now)
- Historical analytics or persistent storage beyond a rolling buffer
- Authentication or multi-user access (local network tool)
- Supporting non-Claude-Code agent output formats
- Mobile or responsive design (desktop dashboard)

## Capabilities

### New Capabilities

- `jsonl-capture`: loop.sh tees stream-json output to `/tmp/ralph/<session>.jsonl`
- `ssh-tail`: Backend maintains SSH connections to VMs and tails JSONL files in real-time
- `event-parser`: Transforms raw JSONL lines into typed, summarized events with tool call/result pairing
- `websocket-relay`: Pushes parsed events to connected frontends via WebSocket
- `dashboard-ui`: Svelte 5 grid of VM cards with live event feeds, status indicators, and expandable detail

## Impact

- `loop.sh` (on each VM): Add tee to file, ~3 lines changed
- `src/server/`: New backend — SSH connections, JSONL parsing, WebSocket server
- `src/lib/parser/`: New JSONL-to-event parser with narrative summaries
- `src/frontend/`: New Svelte 5 dashboard app
- `package.json`: New project with bun, svelte, ssh2, ws dependencies
