## 1. Update types

- [x] 1.1 Make `key` optional in `VmConfig`, add optional `password` field

## 2. Update SSH manager

- [x] 2.1 Update `connect()` to branch on key vs password auth
- [x] 2.2 Add startup validation: each VM must have `key` or `password`

## 3. Update config

- [x] 3.1 Update `ralph-monitor.yaml` with password auth example (commented, with warning)
- [x] 3.2 Add `ralph-monitor.yaml` to `.gitignore` to prevent committing secrets
