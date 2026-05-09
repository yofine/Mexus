---
name: mission-agent-remove
description: Remove an Agent roster entry from the active Mission agents.md without closing panes.
argument-hint: <agent-name>
---

# `/mission-agent-remove`

Use this skill when the user invokes `/mission-agent-remove <agent-name>`.

This command edits only the active Mission's `agents.md`. It does not close panes, does not touch kanban, and does not modify other Mission files.

1. Validate that `<agent-name>` is present.
2. Run `mexus mission active --json` and parse `<active>`. If no active Mission exists, fail clearly.
3. Read `agent-team/missions/<active>/agents.md`.
4. Remove the row for `<agent-name>` from `## Agent Names`.
5. Remove the full `## Agent: <agent-name>` section, from that heading up to the next `## Agent:` heading or end of file.
6. Preserve all other Agent sections and the Inbox Protocol section.
7. Run `mexus pane list --mission <active> --json`. If any returned Pane has `mission.agentName === <agent-name>`, print exactly:

   ```text
   Note: Pane <id> still has mission.agentName=<agent-name>; close it via `mexus pane close <id>` if it should not continue receiving Inbox events.
   ```

8. Show the proposed `agents.md` edit to Squad Lead for review before saving. Save only after Squad Lead accepts.
