# Dashboard UI

**Source:** `src/frontend/`

Svelte 5 + SvelteKit single-page dashboard. Connects via WebSocket, renders loop cards with live event feeds.

## Requirements

### Loop Card Layout

- **WHEN** the dashboard loads
- **THEN** each discovered loop is shown as a card in a vertical scrolling list
- **AND** cards show: VM name, session file, project, iteration count, model, branch, mode
- **AND** cards are sorted by `startedAt` (newest first)

### Health Indicator

- **WHEN** a loop has `health: "running"` → green dot (◉)
- **WHEN** `health: "completed"` → purple dot (●)
- **WHEN** `health: "errored"` → red dot (✕)
- **WHEN** `health: "stale"` → amber dot (○)

### Live Event Feed

- **WHEN** a card is expanded
- **THEN** show a chronological event feed (oldest at top, newest at bottom)
- **AND** auto-scroll to bottom unless the user has scrolled up

- **WHEN** a `tool_paired` event is displayed
- **THEN** show: tool icon, narrative summary, duration badge

- **WHEN** a `thinking` event is displayed
- **THEN** show truncated excerpt, expandable to full text on click

- **WHEN** an `iteration` event is displayed
- **THEN** show a separator with "Iteration N" label

- **WHEN** a `tool_call` is pending (no result yet)
- **THEN** show it with a pulsing yellow indicator

### Expandable Detail

- **WHEN** the user clicks an event
- **THEN** expand to show raw JSON detail (args, full text, result)
- **AND** clicking again collapses it

### Delete Button

- **WHEN** the user clicks the `×` button on a card header
- **THEN** send `DELETE /api/loops/:loopId`
- **AND** the card disappears only after the `loop_removed` WS broadcast (not optimistic)

### On-Demand Event Loading

- **WHEN** a closed (non-running) card is expanded
- **THEN** fetch events from `GET /api/loops/:loopId/events`
- **AND** populate the feed without requiring a WebSocket replay

### Status Bar

- **WHEN** the dashboard is active
- **THEN** a status bar shows: total event count, connection status
