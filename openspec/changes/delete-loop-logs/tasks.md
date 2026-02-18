## 1. Types

- [x] 1.1 Add `LoopRemovedMessage` interface to `src/lib/types.ts`
- [x] 1.2 Add `"loop_removed"` to `WsMessage` union type

## 2. Manager Layer

- [x] 2.1 Add `deleteFile(filePath: string): Promise<void>` to `SshManager` — runs `rm` via SSH exec, removes from `tailedFiles`
- [x] 2.2 Add `deleteFile(filePath: string): Promise<void>` to `LocalWatcher` — `fs.unlinkSync`, cleanup poll state

## 3. Pipeline

- [x] 3.1 Store managers indexed by vmName (`Map<string, SshManager | LocalWatcher>`)
- [x] 3.2 Add `removeLoop(loopId: string): Promise<void>` — lookup state, call manager.deleteFile, cleanup loopStates/buffers/pairers, emit `loop_removed`

## 4. Server API

- [x] 4.1 Add `DELETE /api/loops/:loopId` endpoint in `src/server/index.ts` — call `pipeline.removeLoop()`, return 200/404

## 5. WebSocket Relay

- [x] 5.1 Listen for `loop_removed` event on pipeline, broadcast `LoopRemovedMessage` to all clients

## 6. Frontend Store

- [x] 6.1 Handle `loop_removed` in `connection.svelte.ts` — delete from `loops` and `events`, trigger reactivity

## 7. VmCard UI

- [x] 7.1 Add delete button (×) to card header in `VmCard.svelte`
- [x] 7.2 Wire button to `DELETE /api/loops/:loopId` fetch call

## 8. Tests

- [x] 8.1 Test `pipeline.removeLoop()` — verify state cleanup and event emission
- [x] 8.2 Test `LocalWatcher.deleteFile()` — verify file deletion and state cleanup
- [x] 8.3 Test `DELETE /api/loops/:id` via WS relay — verify broadcast
- [x] 8.4 Test types — verify `LoopRemovedMessage` is in union
