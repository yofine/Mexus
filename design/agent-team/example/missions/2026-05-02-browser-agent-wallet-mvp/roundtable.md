# Roundtable Reviews

Mission: `2026-05-02-browser-agent-wallet-mvp`

Purpose: Roundtable Reviews provide a lightweight decision mechanism for questions that should not be decided by one agent alone.

Inspired by the Arthurian round table, any agent may convene a review when a decision affects multiple agents, shared interfaces, product direction, sequencing, or mission acceptance.

## Review Rules

### When To Open A Review

Open a roundtable review when:

- a decision affects multiple agents
- a shared interface or protocol may change
- product direction is ambiguous
- two tasks conflict
- an agent proposes a scope expansion
- acceptance criteria need adjustment
- a risk requires explicit trade-off approval

Do not open a review for local implementation details inside one task's scope.

### Who Can Open A Review

Any mission agent or Squad Lead can create a review item under `Pending Review`.

### Invitees

Set `Invitees` to:

- specific agent names when only related workstreams are affected
- `All` when the decision affects the full mission
- `Squad Lead` when product direction or mission scope is unclear

### Voting

Each invitee should add a vote in `Votes`.

Vote format:

```text
AgentName: approve | reject | abstain - short reason
```

### Passing Rule

A review is approved when more than half of non-abstaining votes are `approve`.

If `reject` votes are equal to or greater than `approve` votes, keep the review in `Pending Review` for a narrower proposal or move it to `Rejected`.

`abstain` records participation but does not count toward the approval threshold.

### Decision

The review opener records the final decision after the voting rule is satisfied. If the opener is unavailable, any invitee may record the decision and update `Updated`.

Move the item to:

- `Approved` when the proposal is accepted
- `Rejected` when the proposal is denied

If there is no clear result, keep it in `Pending Review` and ask for more information or a narrower proposal.

### Relationship To Kanban

Roundtable reviews are a decision record and technical discussion channel. They do not directly move kanban state and should not block kanban tasks by default.

Agents may reference approved roundtable conclusions when implementing tasks or drafting plans.

If a review conclusion clearly requires implementation work, an agent may publish a separate kanban task, but the roundtable item itself should remain a discussion and decision artifact rather than a hard task dependency.

Rejected reviews should record why the proposal was rejected so agents do not repeat the same decision.

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
