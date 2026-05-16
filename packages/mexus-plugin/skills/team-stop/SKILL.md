---
name: team-stop
description: Use when a Mexus-launched agent should stop the local Agent Team Web board.
argument-hint: ""
---

# `/team-stop`

Use this skill when the user invokes `/team-stop`.

Run:

```bash
node packages/mexus-plugin/scripts/stop-board.mjs --root "$PWD"
```

This command stops only the board process recorded in `.mexus-agent-team/board.json`.

Do not delete `agent-team/`.
Do not modify Mission files.
