---
name: mission-archive
description: Archive a Mission and close its Mission Panes through the Mexus CLI.
argument-hint: <name> [--force]
---

# `/mission-archive`

Use this skill when the user invokes `/mission-archive <name> [--force]`.

Validate that `<name>` is present. Preserve `--force` only when the user passed it. Then run one of:

```bash
mexus mission archive <name>
mexus mission archive <name> --force
```

If the CLI reports `MissionArchiveBlockedError`, HTTP status `409`, or a running-pane archive refusal, print this actionable guidance:

```text
Mission has running Panes. Either close them with `mexus pane close <id>` or re-run with `--force` to close them automatically.
```

Otherwise, pass through the CLI success or failure output without inventing extra archive state.
