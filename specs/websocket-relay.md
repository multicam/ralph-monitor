# WebSocket Relay

**Source:** `src/server/ws-server.ts`

Pushes parsed events and state changes to connected frontends via WebSocket at `/ws`.

## Requirements

### Snapshot on Connect

- **WHEN** a browser connects to the WebSocket endpoint
- **THEN** the server sends a `snapshot` message containing:
  - All `LoopState` entries (keyed by loopId)
  - Recent events only for loops with `health === "running"` (not all loops)
- **AND** the frontend can immediately render populated feeds

### Event Broadcast

- **WHEN** the pipeline emits a new event for any loop
- **THEN** the server broadcasts an `event` message to all connected clients
- **AND** includes: `loopId`, full `MonitorEvent` object

### Status Broadcast

- **WHEN** a loop's state changes (health, iteration, metadata, connection status)
- **THEN** the server broadcasts a `loop_status` message
- **AND** includes: `loopId`, full `LoopState` snapshot

### Loop Removal Broadcast

- **WHEN** a loop is deleted via the API
- **THEN** the server broadcasts a `loop_removed` message
- **AND** includes: `loopId`

### Message Types

```ts
type WsMessage =
  | { type: "snapshot"; loops: Record<string, LoopState>; recentEvents: Record<string, MonitorEvent[]> }
  | { type: "event"; loopId: string; event: MonitorEvent }
  | { type: "loop_status"; loopId: string; state: LoopState }
  | { type: "loop_removed"; loopId: string }
```

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | All loop states |
| GET | `/api/loops/:loopId/events` | On-demand event loading (last 100) for closed cards |
| DELETE | `/api/loops/:loopId` | Delete loop + remote file |
