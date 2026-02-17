## Context

ralph-monitor is a new project — a web dashboard for monitoring one or more ralph AI agent loops running on Proxmox VMs. Inspired by ghuntley/loom (Rust/Svelte multi-agent monitoring). The OpenSpec config currently has only commented-out examples.

## Goals / Non-Goals

**Goals:**
- Define project identity, tech stack, and domain in `config.yaml`
- Set artifact rules that enforce concise, actionable output
- Capture loom as architectural reference

**Non-Goals:**
- Defining the full application architecture (that's a future change)
- Setting up the actual codebase (no src/ files yet)

## Decisions

### Decision 1: Context content

Include: project name, purpose, tech stack (TypeScript, Svelte 5, Node.js backend, SSH/SFTP), infrastructure (Proxmox VMs, local network), domain (AI agent monitoring), and loom as reference.

Keep it concise — this is read by AI on every artifact generation, so signal-to-noise matters.

### Decision 2: Artifact rules

- Proposals: keep under 500 words, always include non-goals
- Tasks: break into chunks of max 2 hours, use checkbox format
- Specs: use WHEN/THEN/AND scenario format

These are lightweight guardrails, not rigid constraints.
