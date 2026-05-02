---
name: agent-team-mission-workflow
description: Create and operate Markdown-native Mission workflows for multi-agent engineering collaboration in Mexus or similar CLI-agent workbenches. Use when the user wants to split a complex engineering goal across multiple agents, create agent-team mission files, define Squad Lead and agent roles, manage kanban task flow, run publisher review, or use a roundtable voting file for cross-agent decisions.
---

# Agent Team Mission Workflow

Use this skill to create or operate a repository-local Mission workflow for multiple CLI agents.

The mechanism is intentionally Markdown-native. Do not add script validators, external state, dashboards, or runtime orchestration unless the user explicitly asks. The Markdown files are the source of truth because they are tolerant, readable, and editable by both humans and agents.

## Core Model

A **Mission** is a bounded product or engineering objective that can be decomposed into workstreams, assigned to named agents, tracked on a kanban, discussed in a roundtable, and reviewed by task publishers.

Default mission path:

```text
agent-team/missions/<mission-name>/
```

Required mission files:

```text
mission.md
agents.md
kanban.md
roundtable.md
squad-lead.md
```

Repository-level workflow file:

```text
agent-team/mission-workflow.md
```

Repository-level reusable agent roster:

```text
agent-team/agents.md
```

## Roles

**Squad Lead** coordinates the Mission. It preserves mission intent, decomposes workstreams, defines agents, publishes initial tasks, routes dependencies, opens roundtable reviews when needed, and reviews tasks only when `From: Squad Lead`.

**Mission Agents** execute scoped tasks from `kanban.md`. They claim one task at a time, work within `Scope`, fill `Result / Files / Verification`, move work to `Done`, publish follow-up tasks when blocked by another scope, and review tasks only when they are the publisher in `From`.

**User** owns product direction and can override scope, priority, naming, sequencing, and acceptance standards.

## Naming Rules

- Use short stable agent names from Ars Goetia / Lesser Key of Solomon.
- Agent names are only communication handles; they must not encode the task.
- Put responsibilities in `agents.md`, not in names.
- Reuse existing agents from `agent-team/agents.md` when their module history or responsibility fit is close.
- Add a new agent to `agent-team/agents.md` only when no existing agent is a good fit.
- Use short git-commit-like IDs for task and roundtable `Ref` values, such as `a3f9c2d`.

## Create A New Mission

1. Understand the user's mission intent, constraints, implementation order, and minimum acceptance standard.
2. Choose a stable mission directory name, usually `YYYY-MM-DD-short-mission-name`.
3. Create `agent-team/mission-workflow.md` if absent. Use `references/mission-workflow.md` as the base.
4. Create `agent-team/agents.md` if absent. Use `references/agent-roster-template.md` as the base.
5. Create the five mission files. Use templates in `references/`:
   - `mission-template.md`
   - `agents-template.md`
   - `kanban-template.md`
   - `roundtable-template.md`
   - `squad-lead-template.md`
6. Decompose work into independent workstreams with clear file/module scopes.
7. Check `agent-team/agents.md` and assign each workstream to an existing agent when practical; otherwise create a new stable agent name and add it to the roster.
8. Write each agent section with:
   - owner label
   - responsibility
   - stable activation prompt
   - initial implementation prompt
9. Publish initial kanban tasks under `To Claim`.

## Operate An Existing Mission

Before acting, read:

- `agent-team/mission-workflow.md`
- `agent-team/agents.md`
- mission `mission.md`
- mission `agents.md`
- mission `kanban.md`
- mission `roundtable.md`
- if acting as Squad Lead: mission `squad-lead.md`

When claiming work:

1. Move the full task block from `To Claim` to `In Progress`.
2. Update `Updated`.
3. Keep `To: ... | From: ... | Scope: ...` visible.

When completing work:

1. Run the verification commands listed in the task.
2. Move the full task block from `In Progress` to `Done`.
3. Fill `Result`, `Files`, `Verification`, and `Updated`.
4. Leave `Review` for the publishing agent in `From`.

When no assigned task remains:

1. Check `Done` for tasks where `From` is the current agent and `Review` has no accepted marker.
2. Review only those tasks.
3. If accepted, fill `Review`.
4. If rejected, publish a focused fix task under `To Claim`.

## Kanban Task Format

Use this exact shape. Do not add a separate task heading.

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

## Roundtable Rules

Use `roundtable.md` for decisions that affect multiple agents, shared interfaces, mission scope, product direction, sequencing, acceptance criteria, or major risk trade-offs.

Do not make Roundtable a hard Kanban dependency by default. It is a discussion and decision record outside the main task chain. Agents may reference approved conclusions when implementing tasks or drafting plans.

Approval rule: a review is approved when more than half of non-abstaining votes are `approve`. `abstain` records participation but does not count toward the approval threshold.

## Output Style

When creating or updating a Mission, report:

- files created or changed
- agent names and workstreams
- kanban tasks published or moved
- open questions only if they block the Mission

Keep the final response concise and in the user's language.
