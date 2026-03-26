# Delete Loop

**Source:** `src/server/index.ts`, `src/server/pipeline.ts`, `src/server/ssh-manager.ts`, `src/server/local-watcher.ts`, `src/frontend/`

One-click deletion of a loop's JSONL file from the dashboard.

## Requirements

### Delete Flow

```
VmCard (× button)
  │  DELETE /api/loops/:loopId
  ▼
Server API
  │  pipeline.removeLoop(loopId)
  ▼
Pipeline
  │  1. Lookup loopState → get sessionFile + vmName
  │  2. Delete from loopStates, buffers, pairers
  │  3. Emit "loop_removed"
  │  4. manager.deleteFile(sessionFile) in background
  ▼
SshManager: rm -f via SSH exec
LocalWatcher: fs.unlinkSync
  ▼
WsRelay broadcasts { type: "loop_removed", loopId }
  ▼
Frontend store removes loop → card disappears
```

### Security

- **WHEN** a `DELETE /api/loops/:loopId` request arrives
- **THEN** the server resolves `sessionFile` from its own `loopStates` map
- **AND** no client-supplied path reaches the filesystem (no path traversal)

### Error Handling

- **WHEN** the remote file is already gone or `rm` fails
- **THEN** the API still returns 200 and cleans up server state
- **AND** the desired outcome (file gone, card removed) is achieved

### Consistency

- **WHEN** multiple browser tabs are open
- **THEN** all tabs see the card disappear via WS broadcast
- **AND** no optimistic removal — the frontend waits for `loop_removed`
