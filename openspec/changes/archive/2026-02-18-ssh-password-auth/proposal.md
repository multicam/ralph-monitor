## Why

The SSH manager only supports key-based authentication. Some Proxmox VMs may not have SSH keys set up yet, or the user may prefer password auth for quick setup. Adding password as an alternative auth method makes ralph-monitor easier to get running.

## What Changes

- Make `key` optional in `VmConfig` — if omitted, use `password` instead
- Add `password` as an optional field in VM config
- Update `SshManager.connect()` to use the appropriate auth method
- Update `ralph-monitor.yaml` example to show both options

## Non-Goals

- Interactive password prompts (password is in config file)
- Keychain/secret manager integration
- SSH agent forwarding
- Encrypting the config file

## Capabilities

### Modified Capabilities

- `ssh-tail`: Supports both key-based and password-based SSH authentication

## Impact

- `src/lib/types.ts`: Make `key` optional, add optional `password` to `VmConfig`
- `src/server/ssh-manager.ts`: Branch on key vs password in `connect()`
- `ralph-monitor.yaml`: Add password auth example
