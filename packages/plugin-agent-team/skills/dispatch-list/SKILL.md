---
name: dispatch-list
description: List panes attached to the active Mission for Squad Lead dispatch decisions.
argument-hint: ""
---

# `/dispatch-list`

Use this skill when the user invokes `/dispatch-list`.

This command is read-only.

1. Run `mexus mission active --json` and parse `<active>`. If no active Mission exists, fail clearly.
2. Run:

   ```bash
   mexus pane list --mission <active> --json
   ```

3. Format the returned panes as a table:

   ```text
   Agent | Pane ID | Status | Started | Mission Role
   ```

   Use `pane.mission.agentName` for Agent, falling back to `Squad Lead` when `pane.mission.role === "squad-lead"`.
   Use `pane.id`, `pane.status`, `pane.startedAt`, and `pane.mission.role` for the other columns.

4. Highlight panes whose status is `stopped` or `error` by prefixing the status with `NEEDS_REDISPATCH:` so Squad Lead can decide whether to dispatch a replacement Pane.
