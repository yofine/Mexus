# Mexus Agent Team Plugin

`mexus-agent-team` is an on-demand plugin for running Markdown-backed Agent Team Missions from a Mexus workspace.

Install it from Claude Code:

```bash
claude /plugin install mexus-agent-team
```

A Mexus instance must be running before these commands can drive panes or mission lifecycle state.

## Core Commands

- `/mission-create <name> "<request>"`: opens a Squad Lead Pane with the original request; the Squad Lead authors Mission files from references.
- `/mission-activate <name>`: activates an existing Mission through `mexus mission activate`.
- `/mission-archive <name> [--force]`: archives a Mission, deactivates it if active, and closes Mission Panes.
- `/dispatch <agent-name>`: ensures a Mission Agent Pane exists with the right Mission metadata.

## Secondary Commands

- `/mission-agent-add <agent-name>`: guides Squad Lead through adding an Agent section to `agents.md`.
- `/mission-agent-remove <agent-name>`: guides Squad Lead through removing an Agent section from `agents.md`.
- `/dispatch-list`: lists panes attached to the active Mission.

## References

The `references/` directory contains the Mission workflow and file templates Squad Lead should read when drafting Mission files. The slash commands intentionally do not generate the Mission Markdown files themselves.
