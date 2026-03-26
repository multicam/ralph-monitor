# Local Watcher

**Source:** `src/server/local-watcher.ts`, `src/server/index.ts`

Filesystem-based alternative to SSH for monitoring loops on the local machine. Activated via `--local` CLI flag or `local: true` in YAML config.

## Requirements

### Local Mode CLI

- **WHEN** the server starts with `--local`
- **THEN** it skips `ralph-monitor.yaml` entirely
- **AND** creates a synthetic config watching `~/.claude/projects/`
- **AND** uses the machine hostname as the VM name
- **AND** only discovers session files modified within the last 15 minutes

### Custom Watch Directory

- **WHEN** `--local --watch-dir <path>` is provided
- **THEN** the watcher uses the custom path instead of `~/.claude/projects/`
- **AND** the 15-minute recency filter is disabled (watches all `.jsonl` files)

### File Discovery

- **WHEN** the watcher starts
- **THEN** it recursively finds all `.jsonl` files in the watch directory
- **AND** skips `subagents/` directories (only monitors top-level sessions)
- **AND** re-scans every 10 seconds for new files
- **WHEN** `maxAgeMs` is set on the VM config
- **THEN** only files with `mtime` within the age window are discovered

### File Tailing

- **WHEN** a new `.jsonl` file is discovered
- **THEN** the watcher starts from the current end of file (like `tail -f`)
- **AND** reads the first line for metadata extraction (project, model)
- **AND** polls for new content every 500ms
- **AND** emits `line`, `status`, and `vm_connection` events (same interface as SshManager)

### Project Name Extraction

- **WHEN** a session file lives under `~/.claude/projects/<encoded-dir>/`
- **THEN** the pipeline decodes the directory name back to a project name
- **AND** uses greedy filesystem path resolution (checks `existsSync` at each dash to distinguish path separators from literal dashes)
- **AND** falls back to the last segment if resolution fails

### File Deletion

- **WHEN** `deleteFile(path)` is called
- **THEN** the watcher removes the file with `unlinkSync`
- **AND** stops polling it
