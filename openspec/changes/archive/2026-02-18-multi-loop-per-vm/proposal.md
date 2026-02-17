## Why

The SSH manager currently discovers and tails only the single most recent `.jsonl` file per VM. But a VM can run multiple ralph loops simultaneously — different projects, different branches, plan and build in parallel. Today, all but the newest loop would be invisible.

## What Changes

- SSH manager discovers ALL active `.jsonl` files in `/tmp/ralph/`, not just the most recent
- Each file gets its own tail stream and its own event pipeline
- VM cards in the UI show multiple loops as sub-feeds (or separate cards per loop)
- The vmId concept expands from just VM name to VM + session file

## Non-Goals

- Cross-loop coordination or aggregation
- Limiting how many loops a VM can run
- Auto-grouping loops by project

## Capabilities

### Modified Capabilities

- `ssh-tail`: Discovers and tails all `.jsonl` files in `/tmp/ralph/`, not just the newest
- `dashboard-ui`: Displays multiple loops per VM, each with its own event feed

## Impact

- `src/server/ssh-manager.ts`: Tail multiple files, emit with file-level identity
- `src/server/pipeline.ts`: Track state/buffer per loop (vm + session), not per VM
- `src/lib/types.ts`: Add loop identity concept (vmId + sessionFile or derived loopId)
- `src/frontend/`: VM cards show multiple feeds, or grid shows one card per loop
