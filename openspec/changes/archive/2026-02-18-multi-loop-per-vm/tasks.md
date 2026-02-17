## 1. Types

- [x] 1.1 Add `loopId` concept to types: `{vmName}:{sessionBasename}`
- [x] 1.2 Update `VmState` to `LoopState` — keyed by loopId instead of vmId
- [x] 1.3 Update WebSocket message types to use loopId

## 2. SSH Manager

- [x] 2.1 Discover ALL `.jsonl` files in `/tmp/ralph/`, not just the most recent
- [x] 2.2 Start a `tail -f` exec channel per file on the same SSH connection
- [x] 2.3 Emit lines with both `vmId` and `sessionFile` so pipeline can derive `loopId`
- [x] 2.4 Detect new files on periodic re-list, start tailing them
- [x] 2.5 Track stale files (no new data in 5 min), emit status as "inactive"

## 3. Pipeline

- [x] 3.1 Key buffers and state by `loopId` instead of `vmId`
- [x] 3.2 Create new EventPairer per loop (not per VM)
- [x] 3.3 Emit events and status with `loopId`

## 4. WebSocket + Frontend

- [x] 4.1 Update snapshot/event/status messages to use `loopId`
- [x] 4.2 Update frontend store to key by `loopId`
- [x] 4.3 Group loop cards under VM headers in the grid
- [x] 4.4 Show inactive loops with dimmed styling
