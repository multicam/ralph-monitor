## ADDED Requirements

### Requirement: Project Context Defined

The OpenSpec config must contain project context so that all generated artifacts reflect ralph-monitor's identity, stack, and conventions.

#### Scenario: Artifact generation reads context

- **WHEN** OpenSpec generates any artifact (proposal, spec, design, tasks)
- **THEN** the project context (domain, stack, conventions) is available
- **AND** the generated content reflects ralph-monitor specifics, not generic defaults

#### Scenario: Rules constrain artifact format

- **WHEN** OpenSpec generates a proposal
- **THEN** it follows the configured rules (e.g., concise, include non-goals)
- **AND** task artifacts are broken into small, implementable chunks
