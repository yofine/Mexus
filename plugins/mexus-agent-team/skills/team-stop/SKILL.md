---
name: team-stop
description: Use when stopping the local Web board for a Markdown-only Agent Team Mission.
argument-hint: ""
---

# `/mexus-skill:team-stop`

Use this skill when the user invokes `/mexus-skill:team-stop`.

Run:

```bash
node <plugin-root>/scripts/stop-board.mjs --root "$PWD"
```

This stops only the board process metadata owned by this plugin. It must not delete `agent-team/` or edit Mission files.
