# Roundtable

Mission: `hub-agent-team-mission-mvp`

Purpose: Record cross-agent decisions that affect shared interfaces, mission scope, sequencing, acceptance criteria, or major risk trade-offs.

Roundtable is not the Kanban execution path. Do not make Roundtable a hard Kanban dependency by default.

## Review Rules

- Invitees can be specific agents, `All`, or `Squad Lead`.
- A review is approved when more than half of non-abstaining votes are `approve`.
- `abstain` records participation but does not count toward the approval threshold.
- `reject` greater than or equal to `approve` means the review should remain pending for narrowing or move to Rejected.

## Review Item Format

```md
Ref: Short git-commit-like review identifier.
Topic: Short decision topic
Opened by: AgentName
Invitees: AgentName, AgentName | All | Squad Lead
Scope: path/module/protocol/product area
- Question: What decision needs to be made?
- Context: Relevant background, constraints, and current state.
- Options: Concrete options under consideration.
- Recommendation: The opener's recommended option and why.
- Votes: Agent votes and short reasons.
- Decision: Final decision and owner.
- Follow-up: Related kanban task or reason no task is needed.
- Updated: Last update timestamp and agent label.
```

## Pending Review

No review items opened yet.

## Approved

No review items approved yet.

## Rejected

No review items rejected yet.
