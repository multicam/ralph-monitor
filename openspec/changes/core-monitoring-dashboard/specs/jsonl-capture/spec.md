## ADDED Requirements

### Requirement: JSONL Output Capture

loop.sh must write stream-json output to a file while preserving terminal output.

#### Scenario: Output is teed to file

- **WHEN** loop.sh starts a claude invocation
- **THEN** stdout is piped through `tee` to `/tmp/ralph/<timestamp>-<mode>.jsonl`
- **AND** terminal output is unchanged (user sees the same thing as before)

#### Scenario: Output directory is created

- **WHEN** loop.sh starts
- **THEN** `/tmp/ralph/` is created if it doesn't exist (via `mkdir -p`)

#### Scenario: Each iteration appends to the same file

- **WHEN** a new loop iteration begins within the same loop.sh invocation
- **THEN** output continues to the same JSONL file (not a new file per iteration)
- **AND** loop boundary markers (`=== LOOP N ===`) are also captured in the file

#### Scenario: Non-JSON lines are preserved

- **WHEN** loop.sh prints non-JSON output (header block, loop markers, git output)
- **THEN** those lines are also written to the file
- **AND** consumers can distinguish JSON from non-JSON lines by attempting parse
