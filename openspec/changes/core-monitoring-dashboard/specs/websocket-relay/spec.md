## ADDED Requirements

### Requirement: WebSocket Event Relay

The backend pushes parsed events to connected frontends via WebSocket.

#### Scenario: Frontend connects

- **WHEN** a browser connects to the WebSocket endpoint
- **THEN** the backend sends a `snapshot` message with current state of all VMs
- **AND** includes: VM list, connection status, current iteration, last N events per VM

#### Scenario: New event from parser

- **WHEN** the event parser emits a new event for any VM
- **THEN** the backend broadcasts it to all connected WebSocket clients
- **AND** the message includes: vm_id, event object, timestamp

#### Scenario: VM status change

- **WHEN** a VM connects, disconnects, starts a new session, or changes iteration
- **THEN** the backend broadcasts a `vm_status` message
- **AND** includes: vm_id, status (connected/disconnected/idle), metadata

### Requirement: Rolling Event Buffer

The backend maintains a rolling buffer of recent events per VM.

#### Scenario: Buffer size

- **WHEN** events are received
- **THEN** the backend keeps the last 500 events per VM in memory
- **AND** older events are discarded (FIFO)

#### Scenario: Initial snapshot uses buffer

- **WHEN** a new frontend connects
- **THEN** it receives the last 100 events per VM from the buffer
- **AND** can immediately render a populated feed without waiting for new activity
