## Why

The OpenSpec config has empty `context` and `rules` sections. Without project context, every artifact gets generated blind — no awareness of the tech stack, domain, or conventions. This is the first thing to fill in for any OpenSpec project.

## What Changes

- Add `context` field with ralph-monitor's identity: web dashboard for monitoring ralph loops on Proxmox VMs
- Add tech stack: TypeScript, Svelte frontend, SSH/SFTP for VM access
- Add `rules` for artifact conventions (concise proposals, small tasks)
- Reference loom (ghuntley/loom) as architectural inspiration

## Capabilities

### New Capabilities
- `project-context`: OpenSpec artifacts are generated with full awareness of ralph-monitor's stack, domain, and conventions

## Impact

- `openspec/config.yaml`: Replace commented examples with real project context and rules
