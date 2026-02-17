## Context

Ralph loops run Claude Code headless (`claude -p --output-format=stream-json`) on Proxmox VMs via SSH. Output is JSONL to stdout — currently ephemeral. Each JSONL line contains a complete message: assistant tool calls, user tool results, or assistant text. The loop script manages iterations, git commits, and mode (plan/build).

We want a web dashboard that aggregates and humanizes this output across 2-5 VMs.

## Goals / Non-Goals

**Goals:**
- Real-time visibility into what each ralph loop is doing, in plain language
- See all loops at a glance in a single browser tab
- Minimal changes to existing loop.sh (just add tee)
- Fast, lightweight — no database, no heavy infrastructure

**Non-Goals:**
- Loop management (start/stop/pause from UI) — monitor only for v1
- Persistent storage — rolling in-memory buffer only
- Authentication — trusted local network
- Mobile support — desktop dashboard

## Architecture

```
VM (Proxmox)                    ralph-monitor server              Browser
────────────                    ──────────────────              ───────

loop.sh                         SSH Manager
  │                               │
  ├─ stdout (terminal)            ├─ ssh2 connection per VM
  │                               ├─ exec: tail -f /tmp/ralph/*.jsonl
  └─ tee ──► .jsonl file ◄───────┤
                                  ▼
                              Event Parser
                                  │
                                  ├─ JSON.parse each line
                                  ├─ Categorize (tool_call, tool_result, thinking, iteration)
                                  ├─ Pair tool calls with results
                                  ├─ Generate narrative summaries
                                  │
                                  ▼
                              Event Buffer (in-memory)
                                  │
                                  ├─ Last 500 events per VM
                                  ├─ Current state snapshot
                                  │
                                  ▼
                              WebSocket Server ──────────► Svelte 5 App
                                                           ├─ VM grid
                                                           ├─ Live feeds
                                                           └─ Status bar
```

## Decisions

### Decision 1: Data capture via tee (not direct stream)

**Approach:** Modify loop.sh to `tee` output to `/tmp/ralph/<timestamp>-<mode>.jsonl`. The monitor reads files over SSH rather than intercepting the stream directly.

**Rationale:** Minimal invasion. loop.sh is unchanged except for one pipe addition. The file acts as a buffer — if the monitor restarts, it can catch up by reading the file from the current position. Terminal output is preserved for direct SSH debugging.

**Tradeoff:** Adds ~3 lines to loop.sh. File in /tmp is ephemeral (lost on reboot) — acceptable for v1 since we don't persist history anyway.

### Decision 2: ssh2 library for VM connections

**Approach:** Use the `ssh2` npm package for SSH connections. One persistent connection per VM, running `tail -f` via exec channel.

**Rationale:** Native SSH from Node/Bun. No need for external SSH processes or agents on VMs. Supports key-based auth which is already set up for the Proxmox VMs.

**Alternative considered:** Deploying an agent/daemon on each VM that serves JSONL over HTTP. Rejected — adds operational complexity, requires installation on each VM, and SSH is already available.

### Decision 3: In-memory event buffer, no database

**Approach:** Keep last 500 events per VM in a circular buffer in memory. New WebSocket clients get the last 100 on connect.

**Rationale:** This is a real-time monitoring tool, not an analytics platform. Memory usage is bounded (~500 events * 5 VMs * ~2KB = ~5MB). If the server restarts, feeds rebuild from the live JSONL files within seconds.

### Decision 4: Svelte 5 + SvelteKit for frontend

**Approach:** SvelteKit app with a single dashboard page. No SSR needed — pure client-side WebSocket consumer.

**Rationale:** Matches the project config (Svelte 5). Svelte's reactivity model is ideal for streaming data — each VM's event store is a reactive array that the UI subscribes to. SvelteKit gives us dev server, build tooling, and routing for free even though we only have one page.

### Decision 5: Monorepo with shared types

**Approach:** Single package with:
- `src/server/` — backend (SSH, parser, WebSocket)
- `src/lib/` — shared types and parser logic
- `src/frontend/` — SvelteKit app

**Rationale:** The event types and parser are shared between backend and frontend (frontend needs types for rendering, backend produces them). A monorepo with shared `src/lib/` avoids package publishing overhead for a single-purpose tool.

### Decision 6: VM configuration via YAML file

**Approach:** `ralph-monitor.yaml` in project root:
```yaml
vms:
  - name: vm-01
    host: 192.168.1.101
    user: jean-marc
    key: ~/.ssh/id_ed25519
  - name: vm-02
    host: 192.168.1.102
    user: jean-marc
    key: ~/.ssh/id_ed25519
```

**Rationale:** Simple, human-editable, versionable. No UI for config in v1. YAML matches the OpenSpec config pattern already in use.
