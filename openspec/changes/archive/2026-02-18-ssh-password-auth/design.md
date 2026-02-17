## Context

`VmConfig` currently requires `key: string`. The `SshManager.connect()` method reads the key file and passes it as `privateKey` to ssh2. We need to support `password` as an alternative.

## Goals / Non-Goals

**Goals:**
- Support password auth alongside key auth
- Validate that exactly one of `key` or `password` is provided
- Keep passwords out of git (document in config example)

**Non-Goals:**
- Environment variable substitution in config
- Encrypted config files

## Decisions

### Decision 1: Optional fields with validation

Make both `key` and `password` optional in the type. Validate at startup that each VM has at least one auth method. If both are provided, prefer key.

### Decision 2: No secrets in example config

The `ralph-monitor.yaml` example shows password auth commented out with a note to never commit passwords. The `.gitignore` should include `ralph-monitor.yaml` to prevent accidental commits.
