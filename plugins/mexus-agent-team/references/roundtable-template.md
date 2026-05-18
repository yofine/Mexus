# Roundtable Reviews

Mission: `<mission-name>`

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

Ref: rt-demo
Topic: Example review: confirm first execution slice
Opened by: Squad Lead
Invitees: Agares, Squad Lead
Scope: agent-team/missions/<mission-name>
- Question: Is the first execution slice scoped tightly enough for a background Agent to claim safely?
- Context: This sample item shows how RoundTable proposals render on the board. Replace it when a real multi-Agent decision is needed.
- Options: Keep the first task broad; narrow it to one module; ask the user for clarification before dispatch.
- Recommendation: Narrow the first task to one verifiable module before dispatch.
- Votes: Squad Lead: approve - keeps execution observable; Agares: abstain - waiting for concrete files.
- Decision: Pending.
- Follow-up: Update kanban task scope before dispatch if the Mission is too broad.
- Updated: <YYYY-MM-DD>, Squad Lead

Ref: rt-mock-ui
Topic: Mock review: board information density
Opened by: Agares
Invitees: Squad Lead, Agares
Scope: agent-team/missions/<mission-name>/roundtable.md, board UI
- Question: Should RoundTable show proposal summaries in the list and full review details on the right?
- Context: This mock item exists to preview the board split view with more than one proposal.
- Options: Keep a single markdown feed; split proposal list and detail panel; move roundtable back into the Mission summary.
- Recommendation: Use the split proposal list and detail panel so RoundTable can grow without crowding kanban.
- Votes: Agares: approve - improves scanning; Squad Lead: approve - keeps decisions observable.
- Decision: Pending.
- Follow-up: No kanban task needed for this mock item.
- Updated: <YYYY-MM-DD>, Agares

## Approved

No reviews approved.

## Rejected

No reviews rejected.
