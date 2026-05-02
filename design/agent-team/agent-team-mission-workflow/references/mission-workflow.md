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
- review only tasks they published

## Agent Naming

- Use short stable names from Ars Goetia / Lesser Key of Solomon.
- Names are communication handles and must not encode tasks.
- Responsibilities live in `agents.md`.
- Reuse existing agents from `agent-team/agents.md` when their module history or responsibility fit is close.
- Use short git-commit-like refs for task and roundtable IDs.

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
6. Claim work.
7. Execute work.
8. Complete work.
9. Continue assigned work or review tasks published by self.

## Publisher Review

Tasks are reviewed by their publisher. An agent reviews only tasks where:

- the task is in `Done`
- the task's `From` is the current agent
- the task has no accepted marker in `Review`

If review passes, write:

```text
accepted by: <agent label>, <date> - <reason>
```

If review fails, publish a focused fix task under `To Claim`.
