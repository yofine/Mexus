---
name: roundtable
description: Use when opening a RoundTable proposal in the active Markdown-backed Agent Team Mission.
argument-hint: "\"<topic>\" [--invitees <agents|All|Squad Lead>] [--scope <path/module>] [--question \"<question>\"]"
---

# `/mexus-skill:roundtable`

Use this skill when the user invokes `/mexus-skill:roundtable`.

This command opens a RoundTable proposal in the active Mission's `roundtable.md`. It does not move kanban tasks and it does not execute work. RoundTable is for shared decisions that affect multiple Agents, shared interfaces, product direction, sequencing, acceptance criteria, or major risk trade-offs.

## Steps

1. Locate the active mission under `agent-team/missions/`. If no active lifecycle marker exists, use the newest mission.
2. Read:
   - `agent-team/mission-workflow.md`
   - `agent-team/missions/<mission-name>/roundtable.md`
   - `agent-team/missions/<mission-name>/agents.md`
   - `agent-team/missions/<mission-name>/kanban.md`
3. Create a short ref such as `rt-<topic-slug>` or another short git-commit-like identifier.
4. Append a new item under `## Pending Review` in `roundtable.md`. If the section says `No reviews pending.` or `No review items pending.`, replace that placeholder with the new item.
5. Use the RoundTable item format from `roundtable.md`.

## Required Item Shape

```md
Ref: <short-ref>
Topic: <short topic>
Opened by: Squad Lead
Invitees: <AgentName, AgentName | All | Squad Lead>
Scope: <path/module/protocol/product area>
- Question: <decision question>
- Context: <relevant background>
- Options: <concrete options>
- Recommendation: <recommended option and why>
- Votes:
- Decision: Pending.
- Follow-up:
- Updated: <YYYY-MM-DD>, Squad Lead
```

## Rules

- Use RoundTable only for decisions, not ordinary task execution.
- Do not use RoundTable as a hard kanban dependency by default.
- Do not edit task `Result`, `Files`, `Verification`, or `Review` fields from this command.
- If the proposal creates implementation work, publish a follow-up kanban task after the decision is accepted.

## Output

After opening the proposal, report:

- Mission name.
- RoundTable ref.
- Invitees.
- File updated.
