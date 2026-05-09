---
name: mission-agent-add
description: Add an Agent roster entry to the active Mission agents.md.
argument-hint: <agent-name> [--role mission-agent|squad-lead] [--responsibility "<text>"]
---

# `/mission-agent-add`

Use this skill when the user invokes `/mission-agent-add <agent-name> [--role mission-agent|squad-lead] [--responsibility "<text>"]`.

This command edits only the active Mission's `agents.md`. Does not touch kanban. Do not modify `mission.md`, `kanban.md`, `roundtable.md`, or `squad-lead.md`.

1. Validate that `<agent-name>` is present.
2. Parse optional `--role`; default to `mission-agent`. Accept only `mission-agent` or `squad-lead`.
3. Parse optional `--responsibility`; if omitted, ask Squad Lead for the responsibility before editing.
4. Run `mexus mission active --json` and parse `<active>`. If no active Mission exists, fail clearly.
5. Read `agent-team/missions/<active>/agents.md`.
6. If the file already contains `## Agent: <agent-name>`, stop and report that the Agent already exists.
7. Append a row to `## Agent Names` using the existing table style.
8. Add a new `## Agent: <agent-name>` section following the existing Agent section format. The section must include:
   - Role set from `--role`.
   - Responsibility derived from `--responsibility`.
   - Activation prompt that tells the Agent to read the mission workflow, mission files, kanban, roundtable, and this `agents.md`.
   - Initial prompt that tells the Agent to inspect kanban for tasks addressed to `<agent-name>`, claim one by moving it to In Progress, and follow the Inbox Protocol.
   - The same Inbox Protocol markers and collaboration conventions used by the existing Agent sections.
9. Preserve the existing Inbox Protocol section and all other Agent sections.
10. Show the proposed `agents.md` edit to Squad Lead for review before saving. Save only after Squad Lead accepts.
