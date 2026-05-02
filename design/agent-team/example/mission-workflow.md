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

`agent-team/agents.md` is the long-term roster of known agents, their module ownership, and their work history. Use it when forming a new Mission so existing agent context can be reused instead of creating a new name for every workstream.

Each mission should contain these files:

```text
mission.md
agents.md
kanban.md
roundtable.md
squad-lead.md
```

### `mission.md`

The mission brief. It should describe:

- product or engineering intent
- strategic constraints
- user-facing positioning
- implementation order or sequencing constraints
- minimum acceptance standard

### `agents.md`

The mission roster. It should describe:

- stable agent names
- each agent's responsibility
- each agent's activation prompt
- each agent's initial implementation prompt
- recommended execution order

Agent names are stable communication handles. They do not describe the task.

### `kanban.md`

The task board. It should contain only task tracking information:

- board usage rules
- task format
- `To Claim`
- `In Progress`
- `Done`

General collaboration rules should not be duplicated in the kanban.

### `roundtable.md`

The mission decision board. It should contain:

- review rules
- review item format
- `Pending Review`
- `Approved`
- `Rejected`

Use `roundtable.md` for decisions that affect multiple agents, shared interfaces, mission scope, product direction, or acceptance criteria.

### `squad-lead.md`

The Squad Lead identity and work log. It should contain:

- Squad Lead role definition
- Squad Lead responsibilities
- Squad Lead activation prompt
- mission work log

The work log should record mission work such as decomposition, assignment, sequencing, and review. It should not record meta-work about building the collaboration mechanism itself.

## Roles

### Squad Lead

Squad Lead owns mission coordination, not universal task acceptance.

Squad Lead responsibilities:

- preserve the mission intent
- consult the repository-level agent roster before creating or assigning agents
- decompose the mission into independent workstreams
- choose stable agent names
- assign responsibilities to agents
- publish initial kanban tasks
- maintain task clarity and sequencing
- resolve unclear product direction
- route cross-agent dependencies
- review completed tasks only when `From` is `Squad Lead`
- publish fix tasks when completed work does not satisfy the request

Squad Lead does not own implementation code by default. If implementation is needed, it should be assigned to the appropriate agent unless the user explicitly asks Squad Lead to implement.

### Mission Agent

Mission Agents own implementation or investigation work assigned through the kanban.

Agent responsibilities:

- read the required mission files before acting
- claim one task at a time
- work within the assigned scope
- avoid overwriting another agent's work
- publish follow-up tasks when blocked by another scope
- complete verification before moving work to `Done`
- perform cross-review for tasks they published

### User

The user owns product direction and can override scope, priority, naming, sequencing, and acceptance standards.

If a product decision is unclear, agents should publish a Squad Lead task or ask the user through Squad Lead rather than guessing.

## Agent Naming

- Each agent should have a short, stable, easy-to-recognize name.
- Agent names should be chosen from the Ars Goetia / Lesser Key of Solomon name set for a stable naming convention.
- Agent names must not describe or encode the task.
- Responsibilities are documented separately in `agents.md`.
- Use the short agent name consistently in `To`, `From`, `Updated`, and `Review`.
- Reuse existing agents from `agent-team/agents.md` when their module history or responsibility fit is close.
- Add a new agent to `agent-team/agents.md` only when no existing agent is a good fit.

## Required Reading Before Work

Every agent must read:

- `agent-team/agents.md`
- the mission's `mission.md`
- the mission's `agents.md`
- the mission's `kanban.md`
- the mission's `roundtable.md`
- this `agent-team/mission-workflow.md`

Squad Lead must also read:

- the mission's `squad-lead.md`

## Mission Workflow

### 1. Create The Mission

Squad Lead creates:

- `agent-team/missions/<mission-name>/mission.md`
- `agent-team/missions/<mission-name>/agents.md`
- `agent-team/missions/<mission-name>/kanban.md`
- `agent-team/missions/<mission-name>/roundtable.md`
- `agent-team/missions/<mission-name>/squad-lead.md`

Mission names should be stable and descriptive, commonly date-prefixed:

```text
YYYY-MM-DD-short-mission-name
```

### 2. Write The Mission Brief

Squad Lead records the user's product intent, constraints, desired implementation order, and minimum acceptance standard in `mission.md`.

### 3. Define The Squad

Squad Lead first checks `agent-team/agents.md` for reusable agents, then creates the mission squad and responsibilities in the mission's `agents.md`.

Each agent section should include:

- owner label
- responsibility
- activation prompt
- initial prompt

The activation prompt should let the agent recover identity and responsibilities after conversation context loss.

After assigning a meaningful workstream, Squad Lead should update `agent-team/agents.md` with the agent's primary modules and work history if that information is new.

### 4. Publish Initial Tasks

Squad Lead publishes initial tasks in `kanban.md` under `To Claim`.

Each task must use this format:

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

### 5. Open Roundtable Reviews When Needed

Any agent may open a review in `roundtable.md` when a decision should not be made by one agent alone.

Open a roundtable review for:

- shared protocol or interface changes
- product direction ambiguity
- task conflicts
- scope expansion
- sequencing changes
- acceptance criteria changes
- major risk trade-offs

Do not open a review for local implementation details inside one task's scope.

Review items move through:

- `Pending Review`
- `Approved`
- `Rejected`

Roundtable reviews are a decision record and technical discussion channel. They do not directly move kanban state and should not block kanban tasks by default.

Agents may reference approved roundtable conclusions when implementing tasks or drafting plans. If a review conclusion clearly requires implementation work, an agent may publish a separate kanban task, but the roundtable item itself should remain a discussion and decision artifact rather than a hard task dependency.

Roundtable review items should include a stable short git-commit-like `Ref`, used only for discussion traceability.

### 6. Claim Work

When starting a task, the assigned agent must:

- move the full task block from `To Claim` to `In Progress`
- update `Updated`
- keep the `To: ... | From: ... | Scope: ...` line visible

Agents should claim exactly one task at a time.

### 7. Execute Work

The assigned agent works inside the task scope.

If the agent discovers required work outside its scope, it should publish a new task under `To Claim` for the appropriate agent instead of silently doing that work.

If the agent discovers a decision that needs voting, it should open a `roundtable.md` item instead of embedding the decision inside implementation.

### 8. Complete Work

When completing a task, the assigned agent must:

- run the verification commands listed in the task
- move the task from `In Progress` to `Done`
- fill `Result`
- fill `Files`
- fill `Verification`
- update `Updated`

Default verification for code changes:

```bash
pnpm test
pnpm run build
```

If a task cannot run one of these commands, the agent must record why in `Verification`.

### 9. Continue Or Review

After completing a task, the agent must return to the kanban and:

- check whether more tasks are assigned to itself in `To Claim`
- claim and execute the next matching task if one exists
- if no matching task exists, perform cross-review

### 10. Publisher Review

Tasks are reviewed by their publisher. An agent performs review only for tasks that meet all conditions:

- the task is in `Done`
- the task's `From` is the current agent
- the task has no accepted marker in `Review`

The review checks:

- whether the code changes satisfy `Request`
- whether `Acceptance` was met
- whether `Verification` is present and reasonable
- whether changed files match `Scope`
- whether the completed work still satisfies the publishing agent's original need

Squad Lead follows the same rule as every other agent: Squad Lead reviews tasks only when the task's `From` is `Squad Lead`.

If review passes:

- write `accepted by: <agent label>, <date>` in `Review`
- update `Updated`

If review fails:

- publish a focused fix task under `To Claim`
- set `From` to the reviewing agent
- set `To` to the best agent to fix it
- explain the mismatch or defect in `Request` and `Reason`
- link the reviewed task in the new task's `Request` or `Reason`

## Publishing Follow-Up Tasks

Any agent may publish a task when it discovers work outside its scope.

New tasks must:

- be placed under `To Claim`
- set `From` to the publishing agent
- set `To` to the expected receiving agent
- set `Scope` to the involved path/module
- include a short git-commit-like `Ref`
- include a concrete `Request`
- include the `Reason` this work is needed
- include observable `Acceptance` criteria
- leave `Result`, `Files`, `Verification`, and `Review` empty
- update `Updated`

Tasks should be small enough for one agent to complete without private context.

## Shared File Conflicts

- Shared type changes should be small and backward-compatible when possible.
- If a shared type must change, update the directly affected consumers or publish follow-up tasks immediately.
- If tests fail because another agent's task is in progress, record the failure in the current task and publish a coordination task if needed.
- If product direction is unclear, publish a Squad Lead task instead of guessing.
