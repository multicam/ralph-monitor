## Why

Completed loop logs accumulate in `/tmp/ralph/` on the remote VMs. The dashboard shows all discovered JSONL files as cards, including finished sessions with no new activity. There's no way to clean up without SSH-ing into each VM manually. A one-click delete from the card keeps the dashboard focused on what matters.

## What Changes

- Add a DELETE API endpoint that removes a loop's JSONL file from the remote VM (via SSH exec) or local filesystem
- Clean up server-side state (pipeline loop state, event buffers, tail streams)
- Broadcast removal to all connected frontends via WebSocket
- Add a delete button to the VmCard component

## Non-Goals

- Bulk delete / "clear all" (single loop at a time for now)
- Confirmation dialog (one-click, it's just temp logs)
- Undo / soft delete / archival
- Deleting loops that are actively being written to (could add a guard later)

## Capabilities

### Modified Capabilities

- `ssh-tail`: SSH manager gains `deleteFile(path)` to run `rm` on remote VM
- `event-parser`: Pipeline gains `removeLoop(loopId)` to clean up all internal state
- `websocket-relay`: New `loop_removed` message type broadcast on deletion
- `dashboard-ui`: VmCard gains a delete button; frontend store handles `loop_removed`

## Impact

- `src/lib/types.ts`: New `LoopRemovedMessage` WS message type
- `src/server/ssh-manager.ts`: New `deleteFile()` method
- `src/server/local-watcher.ts`: New `deleteFile()` method
- `src/server/pipeline.ts`: New `removeLoop()` method
- `src/server/ws-server.ts`: Listen for and broadcast `loop_removed`
- `src/server/index.ts`: New `DELETE /api/loops/:loopId` endpoint
- `src/frontend/src/lib/stores/connection.svelte.ts`: Handle `loop_removed` message
- `src/frontend/src/lib/components/VmCard.svelte`: Add delete button
