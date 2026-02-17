## ADDED Requirements

### Requirement: VM Grid Layout

The dashboard displays all monitored VMs in a responsive grid.

#### Scenario: Display VM cards

- **WHEN** the dashboard loads
- **THEN** each configured VM is shown as a card in a grid layout
- **AND** cards show: VM name, connection status, mode (plan/build), iteration number, model, branch, uptime

#### Scenario: Connection status indicator

- **WHEN** a VM is connected and streaming
- **THEN** show a green dot indicator
- **WHEN** a VM is disconnected
- **THEN** show a red dot indicator with "disconnected" label
- **WHEN** a VM has no active loop
- **THEN** show a grey dot indicator with "idle" label

### Requirement: Live Event Feed

Each VM card contains a scrolling feed of parsed events.

#### Scenario: Events appear in real-time

- **WHEN** a new event arrives via WebSocket for a VM
- **THEN** it appears at the top of that VM's feed
- **AND** the feed auto-scrolls unless the user has scrolled up

#### Scenario: Event display format

- **WHEN** a `tool_paired` event is displayed
- **THEN** show: tool icon/name, narrative summary, duration badge
- **WHEN** a `thinking` event is displayed
- **THEN** show: truncated text excerpt, expandable to full text on click
- **WHEN** an `iteration` event is displayed
- **THEN** show: a separator line with "Iteration N" label and timestamp

#### Scenario: Current activity highlight

- **WHEN** a tool_call is pending (no result yet)
- **THEN** it appears at the top of the feed with a pulsing indicator and elapsed timer

### Requirement: Expandable Detail View

Users can expand events to see raw data.

#### Scenario: Click to expand event

- **WHEN** the user clicks on an event in the feed
- **THEN** the event expands to show full detail (raw args, full text, complete result)
- **AND** clicking again collapses it

### Requirement: Aggregate Status Bar

A status bar shows system-wide metrics.

#### Scenario: Display aggregate metrics

- **WHEN** the dashboard is active
- **THEN** a bottom bar shows: total tool calls/min across all VMs, commits in last hour, error count
- **AND** metrics update in real-time
