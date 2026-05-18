# Mission Workflow

This file defines the reusable multi-agent collaboration mechanism for this repository.

The unit of collaboration is a **Mission**: a bounded product or engineering objective that can be decomposed into workstreams, assigned to named agents, tracked on a kanban, and reviewed by task publishers.

Mission-specific materials live under:

```text
agent-team/missions/<mission-name>/
```

The reusable repository-level agent roster lives at:

```text
agent-team/agents.md
```

## Mission File Structure

Repository-level files:

```text
agent-team/mission-workflow.md
agent-team/agents.md
```

`agent-team/agents.md` is the long-term roster of known agents, their module ownership, and their work history.

Each mission should contain:

```text
mission.md
agents.md
kanban.md
roundtable.md
squad-lead.md
```

## Roles

### Squad Lead

Squad Lead owns mission coordination, not universal task acceptance.

Responsibilities:

- preserve mission intent
- consult the repository-level agent roster before creating or assigning agents
- decompose the mission into independent workstreams
- choose stable agent names
- assign responsibilities
- publish initial kanban tasks
- maintain task clarity and sequencing
- resolve unclear product direction
- route cross-agent dependencies
- review completed tasks only when `From` is `Squad Lead`
- publish fix tasks when completed work does not satisfy the request

Squad Lead does not own implementation code by default.

### Mission Agent

Mission Agents own implementation or investigation work assigned through the kanban.

Responsibilities:

- read required mission files before acting
- claim one task at a time
- work within assigned scope
- avoid overwriting another agent's work
- publish follow-up tasks when blocked by another scope
- complete verification before moving work to `Done`
- update their own kanban task block with status, Result, Files, Verification, and Updated
- review only tasks they published

Squad Lead publishes, dispatches, clarifies, integrates, and reviews. Squad Lead does not write execution results for another Agent's task.

## Agent Naming

- Use short stable names from Ars Goetia / Lesser Key of Solomon.
- Names are communication handles and must not encode tasks.
- Responsibilities live in `agents.md`.
- Reuse existing agents from `agent-team/agents.md` when their module history or responsibility fit is close.
- Use short git-commit-like refs for task and roundtable IDs.

## Repository Roster Maintenance

`agent-team/agents.md` is a durable repository memory, not a Mission scratchpad.

Squad Lead should update the repository roster after meaningful completed work is accepted:

- add newly created Agents only when no existing Agent had a close responsibility or module fit
- update Primary modules when the Agent has taken durable ownership of paths or subsystems
- update Known strengths when the Agent demonstrated reusable capability
- append Work history with date, Mission name, workstream, and accepted result
- keep activation prompts and mission-specific instructions out of the repository roster

## Required Reading

Every agent must read:

- `agent-team/agents.md`
- mission `mission.md`
- mission `agents.md`
- mission `kanban.md`
- mission `roundtable.md`
- `agent-team/mission-workflow.md`

Squad Lead must also read:

- mission `squad-lead.md`

## Mission Workflow

1. Create mission files.
2. Write mission brief.
3. Define squad.
4. Publish initial tasks.
5. Open roundtable reviews when needed.
6. Task publisher publishes a scoped task under `To Claim`.
7. Task executor claims the task, completes the work, and self-tests.
8. Task executor fills `Result`, `Files`, `Verification`, and `Updated`, then moves the full task block to `Done`.
9. Task publisher reviews and accepts or publishes a focused fix task.
10. Squad Lead performs mission-level acceptance. If the overall result is below expectation, Squad Lead publishes new focused tasks to the responsible Agents instead of editing another Agent's completed result.

## Publisher Review

Every kanban task has a publisher, recorded in `From`. The publisher owns acceptance for that work item:

- the task is in `Done`
- the task's `From` is the current agent or `Squad Lead`
- the task has no accepted marker in `Review`

If review passes, write:

```text
accepted by: <agent label>, <date> - <reason>
```

If review fails, publish a focused fix task under `To Claim`.

`From` is always the publishing Agent: Squad Lead or an executing Mission Agent. It is never `User`.

## Mission-Level Acceptance

Squad Lead owns overall Mission acceptance. This is separate from publisher review on individual tasks.

If completed work does not satisfy the Mission goal:

1. Squad Lead records the gap in the relevant task `Review` only when Squad Lead is the publisher.
2. Squad Lead publishes a new focused task under `To Claim` for the responsible Agent.
3. The responsible Agent claims, executes, self-tests, and updates that new task.
4. Squad Lead repeats mission-level acceptance after the fix task is Done and reviewed.

Squad Lead must not rewrite execution results for another Agent.

## Responsibility Mismatch

If an executing Agent discovers that a task does not fit its responsibility boundary:

1. If the correct owner is clear, move or leave the task under `To Claim`, change `To` to the right Agent, and add a brief reason in `Updated`.
2. If the correct owner is unclear, publish a clarification task assigned to `Squad Lead` under `To Claim`.
3. Do not execute work outside the Agent's declared responsibility or module scope unless Squad Lead updates `agents.md` and `kanban.md`.
