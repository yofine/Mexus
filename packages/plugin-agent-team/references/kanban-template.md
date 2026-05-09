# Agent Team Kanban

Mission: `<mission-name>`

Board owner: Squad Lead

Last updated: <YYYY-MM-DD>

## Board Usage Rules

This file is only for task state tracking. General collaboration rules live in `../../mission-workflow.md`.

### Status Flow

- `To Claim`: the task is ready for the `To` owner.
- `In Progress`: one agent has claimed the task and is actively working on it.
- `Done`: implementation is finished and the `To` agent has filled `Result`, `Files`, and `Verification`.

Agents should move a task through the board by moving the full task block under the correct status section.

### Task Format

Use this format for every task:

```md
To: Agent-X | From: Agent-Y | Scope: path/or/module
- Ref: Short git-commit-like task identifier. Written by the publishing agent.
- Request: Concrete dependency, implementation request, or question. Written by the publishing agent.
- Reason: Why this task is needed and what it unlocks. Written by the publishing agent.
- Acceptance: Observable completion criteria. Written by the publishing agent.
- Result: What was implemented or decided. Written by the To agent.
- Files: Files added or changed. Written by the To agent.
- Verification: Self-test results and commands run. Written by the To agent.
- Review: Cross-review result. Written by the From agent.
- Updated: Last update timestamp and agent label. Written by whichever agent updates the task.
```

## To Claim

To: <AgentName> | From: Squad Lead | Scope: `<path/or/module>`
- Ref: <short-ref>
- Request: <Concrete request.>
- Reason: <Why this is needed.>
- Acceptance: <Observable completion criteria.>
- Result:
- Files:
- Verification:
- Review:
- Updated: <YYYY-MM-DD>, Squad Lead

## In Progress

No tasks claimed yet.

## Done

No tasks completed yet.
