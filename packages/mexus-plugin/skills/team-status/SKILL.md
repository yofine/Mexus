---
name: team-status
description: Use when a Mexus-launched agent should summarize the current Agent Team Mission kanban in the terminal.
argument-hint: "[--name <mission-name>]"
---

# `/team-status`

Use this skill when the user invokes `/team-status`.

Run:

```bash
node packages/mexus-plugin/scripts/status.mjs
```

Pass `--name <mission-name>` when the user asks for a specific Mission.

Report:

- Active or newest Mission name.
- Counts for `To Claim`, `In Progress`, and `Done`.
- Outstanding tasks grouped by `To`.
- Board URL when `.mexus-agent-team/board.json` exists.

Do not modify Mission files.
