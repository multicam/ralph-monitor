# ralph-monitor specs

Web dashboard for monitoring Claude Code agent loops — running on remote VMs via SSH or locally via filesystem watching.

**Stack:** TypeScript, Svelte 5, Bun, ssh2
**Convention:** WHEN/THEN/AND scenario format

## Spec Index

| Spec | Source | Description |
|------|--------|-------------|
| [ssh-tail](ssh-tail.md) | `src/server/ssh-manager.ts` | SSH connections, file discovery, multiplexed tailing |
| [local-watcher](local-watcher.md) | `src/server/local-watcher.ts` | Local filesystem watching, session discovery, `--local` CLI mode |
| [event-parser](event-parser.md) | `src/lib/parser.ts` | JSONL parsing, event typing, tool pairing, narrative summaries |
| [pipeline](pipeline.md) | `src/server/pipeline.ts` | State management, health detection, metadata extraction |
| [websocket-relay](websocket-relay.md) | `src/server/ws-server.ts` | WebSocket snapshot + broadcast, rolling buffer |
| [dashboard-ui](dashboard-ui.md) | `src/frontend/` | Loop cards, event feed, status bar |
| [delete-loop](delete-loop.md) | Multiple | One-click loop deletion across the full stack |

## Architecture

```
Source (VM or local)            ralph-monitor server              Browser
────────────────────            ──────────────────              ───────

Remote VMs                      SshManager
  └─ .jsonl files ◄─────────── ssh2 connection, multiplexed tail
                                    │
Local machine                   LocalWatcher
  └─ ~/.claude/projects/ ◄──── fs.statSync + polling
                                    │
                                    ▼
                              Pipeline
                                ├─ parseLine() → typed events
                                ├─ EventPairer → tool_call + tool_result → tool_paired
                                ├─ LoopState per session (health, metadata)
                                ├─ 500-event rolling buffer per loop
                                │
                                ▼
                              WsRelay ────────────────► Svelte 5 Dashboard
                                                         ├─ Loop cards (vertical list)
                                                         ├─ Live event feeds
                                                         └─ Status bar
```

## CLI

```sh
bun run dev              # server + frontend (reads ralph-monitor.yaml)
bun run dev:local        # local mode — discovers active Claude Code sessions
bun run dev:server       # backend only

# Flags
--local                  # watch ~/.claude/projects/ instead of using YAML config
--watch-dir <path>       # override watch directory
--port <number>          # override server port (default: 4020)
```
