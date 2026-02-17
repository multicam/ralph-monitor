## Context

Currently: one SSH connection per VM, discovers most recent `.jsonl`, tails it. Pipeline keys everything by `vmId` (the VM name). If two loops run on the same VM, only the newer one is visible.

## Goals / Non-Goals

**Goals:**
- See every active loop on every VM
- Clean identity model: each loop has a unique `loopId` derived from VM name + session file
- Graceful handling when loops start/stop (new files appear, old files stop growing)

**Non-Goals:**
- Detecting that a loop has stopped writing (just show last known state)
- Merging loops that belong to the same project

## Decisions

### Decision 1: Loop identity = `{vmName}:{basename}`

Each loop gets a `loopId` like `vm-01:1739823456-build`. This is the key for buffers, state, and UI cards. The VM name is still visible in the UI but loops are the primary unit.

### Decision 2: One SSH connection, multiple exec channels

ssh2 supports multiple exec channels on a single connection. One `tail -f` per active file, all over the same SSH connection. No need for multiple connections to the same VM.

### Decision 3: Discover all files, detect stale ones

On connect, list ALL `.jsonl` files in `/tmp/ralph/`. Start tailing each one. Periodically re-list to detect new files. A file is considered stale if it hasn't grown in 5 minutes — show it as "inactive" in the UI but keep it visible.

### Decision 4: UI shows one card per loop, grouped by VM

The grid shows cards grouped under VM headers. Each loop gets its own card with its own feed. This keeps the UI simple — no nested feeds.

```
┌─ vm-01 ────────────────────────────────────────────┐
│  ┌─ 1739823456-build ──┐  ┌─ 1739825000-plan ──┐  │
│  │ build #7 / sonnet   │  │ plan #3 / sonnet   │  │
│  │ feature/auth        │  │ main               │  │
│  │ [event feed]        │  │ [event feed]       │  │
│  └─────────────────────┘  └────────────────────┘  │
└────────────────────────────────────────────────────┘
```
