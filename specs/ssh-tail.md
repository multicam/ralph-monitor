# SSH Tail Connection

**Source:** `src/server/ssh-manager.ts`

Persistent SSH connections to remote VMs. Discovers and tails JSONL session files via a single multiplexed exec channel.

## Requirements

### VM Connection

- **WHEN** the backend starts
- **THEN** it reads VM config from `ralph-monitor.yaml` (host, user, key or password)
- **AND** establishes one SSH connection per VM
- **AND** supports both key-based and password auth (with keyboard-interactive fallback)

### File Discovery & Tailing

- **WHEN** connected to a VM
- **THEN** a single exec channel runs a shell script that:
  - Lists all `.jsonl` files in the watch directory (default `/tmp/ralph/`)
  - Tails all discovered files concurrently using `FILE:<path>` prefix framing
  - Re-scans for new files every 10 seconds
- **AND** each new file emits a `status` event with value `"new"`
- **AND** each line emits a `line` event with `(vmId, sessionFile, rawLine)`

### Disconnection & Reconnection

- **WHEN** an SSH connection drops
- **THEN** the manager marks all loops for that VM as `disconnected`
- **AND** attempts reconnection with exponential backoff (1s → 2s → 4s → ... → max 30s)

### Idle VMs

- **WHEN** no `.jsonl` files exist in the watch directory
- **THEN** the VM connection status is set to `idle`
- **AND** the manager continues polling for new files

### File Deletion

- **WHEN** `deleteFile(path)` is called
- **THEN** the manager runs `rm -f` via SSH exec with shell-escaped path
- **AND** removes the file from internal tracking
