## Architecture

The delete flows through the existing layered architecture: Frontend → API → Pipeline → Manager → Filesystem.

```
VmCard (× button)
  │
  │  DELETE /api/loops/:loopId
  ▼
Server API (index.ts)
  │
  │  pipeline.removeLoop(loopId)
  ▼
Pipeline
  │  1. Lookup loopState → get sessionFile + vmName
  │  2. Find matching manager
  │  3. manager.deleteFile(sessionFile)
  │  4. Delete from loopStates, buffers, pairers
  │  5. Emit "loop_removed" event
  ▼
SSH Manager / Local Watcher
  │  SSH: conn.exec(`rm "${filePath}"`)
  │  Local: fs.unlinkSync(filePath)
  │  Cleanup: tailedFiles.delete(filePath)
  ▼
WS Relay
  │  Broadcast { type: "loop_removed", loopId }
  ▼
Frontend Store
  │  delete this.loops[loopId]
  │  delete this.events[loopId]
  │  Trigger reactivity with spread
  ▼
Card disappears from UI
```

## Key Decisions

**Manager lookup**: Pipeline stores `vmName` on each LoopState. Managers need to be findable by vmName, so Pipeline will store a `Map<vmName, manager>` alongside the existing managers array.

**Tail stream cleanup**: SSH `tail -f` follows the inode, so `rm` alone won't close the stream. The `deleteFile` method removes from `tailedFiles` map. The orphaned stream will close when the SSH channel is cleaned up or the next poll cycle detects the file is gone.

**Error handling**: If `rm` fails (file already gone, permission denied), the API still returns 200 and cleans up server state. The file being gone is the desired outcome either way.

**Security**: The API receives a `loopId`, not a file path. The server looks up the `sessionFile` from its own `loopStates` map — no path traversal possible from the client.

## WS Message Type

```ts
interface LoopRemovedMessage {
  type: "loop_removed";
  loopId: string;
}
```

Added to the `WsMessage` union type.

## Frontend Delete Button

Small `×` button in the card header, positioned after the chevron. Uses `fetch` to call `DELETE /api/loops/:loopId`. No optimistic removal — waits for the WS broadcast to actually remove the card (ensures consistency across multiple browser tabs).
