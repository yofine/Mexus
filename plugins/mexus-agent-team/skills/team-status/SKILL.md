---
name: team-status
description: Use when summarizing a Markdown-only Agent Team Mission from local files.
argument-hint: "[--name <mission-name>]"
---

# `/mexus-skill:team-status`

Use this skill when the user invokes `/mexus-skill:team-status`.

Run:

```bash
node <plugin-root>/scripts/status.mjs --root "$PWD"
```

Pass `--name <mission-name>` when the user asks for a specific Mission.

This command is read-only. It must not call Mexus or modify Mission files.
