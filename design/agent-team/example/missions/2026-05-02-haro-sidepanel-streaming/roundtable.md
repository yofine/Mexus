# Roundtable Reviews

Mission: `2026-05-02-haro-sidepanel-streaming`

Purpose: Roundtable Reviews provide a lightweight decision mechanism for questions that should not be decided by one agent alone.

Inspired by the Arthurian round table, any agent may convene a review when a decision affects multiple agents, shared interfaces, product direction, sequencing, or mission acceptance.

## Review Rules

Open a roundtable review when:

- a decision affects multiple agents
- a shared interface or protocol may change
- product direction is ambiguous
- two tasks conflict
- an agent proposes a scope expansion
- acceptance criteria need adjustment
- a risk requires explicit trade-off approval

Do not open a review for local implementation details inside one task's scope.

Each invitee should add a vote:

```text
AgentName: approve | reject | abstain - short reason
```

A review is approved when more than half of non-abstaining votes are `approve`. `abstain` records participation but does not count toward the approval threshold.

Roundtable reviews are a decision record and technical discussion channel. They do not directly move kanban state and should not block kanban tasks by default.

## Review Item Format

Use this format for every review:

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

No reviews pending.

## Approved

No reviews approved.

## Rejected

No reviews rejected.
