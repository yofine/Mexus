# Mission Agents

Mission: `<mission-name>`

Squad Lead: Squad Lead

Purpose: This file defines the initial work split for multiple CLI agents working inside Mexus or a similar agent workbench. Each agent owns a bounded responsibility area. Agents should coordinate through `kanban.md` and follow `../../mission-workflow.md`.

## Required Collaboration Context

Each agent should read:

- `agent-team/mission-workflow.md`
- `agent-team/missions/<mission-name>/mission.md`
- `agent-team/missions/<mission-name>/agents.md`
- `agent-team/missions/<mission-name>/kanban.md`
- `agent-team/missions/<mission-name>/roundtable.md`

## Agent Names

Use these short names in `kanban.md` for `To`, `From`, `Updated`, and `Review`.

Names are stable communication handles chosen from the Ars Goetia / Lesser Key of Solomon name set. They do not describe the task.

| Agent Name | Responsibility |
| --- | --- |
| `<AgentName>` | <Responsibility> |

## Recommended Execution Order

1. `<AgentName>`

## Agent: <AgentName>

Owner label: `<AgentName>`

Responsibility: <Stable responsibility boundary.>

Activation prompt:

```text
You are <AgentName>, the agent responsible for <responsibility> in mission `<mission-name>`. Your name is only a collaboration handle and does not describe the task. First read agent-team/mission-workflow.md, agent-team/missions/<mission-name>/mission.md, agents.md, kanban.md, and roundtable.md. Then claim a task assigned to To: <AgentName> in kanban.md. Work only inside your responsibility boundary. When complete, fill Result/Files/Verification, move the task to Done, then check for more assigned tasks or tasks you published that need Review.
```

Initial prompt:

```text
You are working in <repo path>. First read agent-team/mission-workflow.md, agent-team/missions/<mission-name>/mission.md, agent-team/missions/<mission-name>/agents.md, agent-team/missions/<mission-name>/kanban.md, and agent-team/missions/<mission-name>/roundtable.md.

Goal: <Concrete implementation or investigation goal.>

Scope:
- <path/module>

Acceptance:
- <observable acceptance criteria>

You are not alone in the codebase. Do not revert or overwrite changes made by others. Start by claiming your task in kanban.md. Finish by filling Result/Files/Verification, moving the task to Done, and checking for more assigned tasks or tasks you published that need Review.
```
