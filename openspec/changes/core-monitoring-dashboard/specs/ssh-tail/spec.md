## ADDED Requirements

### Requirement: SSH Tail Connection

The backend maintains persistent SSH connections to configured VMs and tails JSONL files.

#### Scenario: Connect to configured VMs on startup

- **WHEN** the backend starts
- **THEN** it reads VM configuration (host, user, key path) from a config file
- **AND** establishes an SSH connection to each configured VM

#### Scenario: Discover active JSONL files

- **WHEN** connected to a VM
- **THEN** the backend lists files in `/tmp/ralph/`
- **AND** identifies the most recent `.jsonl` file as the active session
- **AND** begins tailing it (`tail -f` over SSH exec)

#### Scenario: Detect new sessions

- **WHEN** a new `.jsonl` file appears in `/tmp/ralph/` (newer than current)
- **THEN** the backend switches to tailing the new file
- **AND** emits a `session_start` event

#### Scenario: Handle SSH disconnection

- **WHEN** an SSH connection drops
- **THEN** the backend marks that VM as disconnected
- **AND** attempts reconnection with exponential backoff (1s, 2s, 4s... max 30s)
- **AND** the frontend shows the VM as disconnected

#### Scenario: Handle idle VMs

- **WHEN** no `.jsonl` files exist in `/tmp/ralph/`
- **THEN** the VM is shown as "no active loop"
- **AND** the backend polls `/tmp/ralph/` every 5s for new files
