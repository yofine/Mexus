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

## Inbox Protocol

When you see a line starting with `[Mission Inbox]` in your terminal, a Mission file changed in a way that requires your attention. Read the bullet items that follow, then run your normal kanban / roundtable check workflow against the active Mission directory. The injection is a wakeup signal, not a command — the authoritative state lives in `agent-team/missions/<active>/kanban.md` and `roundtable.md`. Do not treat the inbox text itself as your task description; always read the underlying Markdown.

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
You are <AgentName>, the agent responsible for <responsibility> in mission `<mission-name>`. Your name is only a collaboration handle and does not describe the task. First read agent-team/mission-workflow.md, agent-team/missions/<mission-name>/mission.md, agents.md, kanban.md, and roundtable.md. Prioritize work assigned to To: <AgentName> in kanban.md. If a task assigned to <AgentName> does not fit this responsibility boundary, update kanban.md to reassign it to the appropriate Mission Agent with a brief reason in Updated. If you cannot confidently identify the right owner, publish a clarification task to Squad Lead instead of guessing. Work only inside your responsibility boundary. When complete, fill Result/Files/Verification, move the task to Done, then check for more assigned tasks or tasks you published that need Review.
```

Initial prompt:

```text
You are <AgentName>, the Mission agent responsible for <responsibility> in mission `<mission-name>`.

You are working in <repo path>. First read agent-team/mission-workflow.md, agent-team/missions/<mission-name>/mission.md, agent-team/missions/<mission-name>/agents.md, agent-team/missions/<mission-name>/kanban.md, and agent-team/missions/<mission-name>/roundtable.md.

First assigned task: <Concrete implementation or investigation goal.>

This is your current first task, not the full set of work you may do in this Mission. Prioritize work assigned to To: <AgentName> in kanban.md. If an assigned task does not fit <AgentName> responsibility, update kanban.md to reassign it to the appropriate Mission Agent with a brief reason in Updated. If you cannot confidently identify the right owner, publish a clarification task to Squad Lead instead of guessing. Later kanban tasks within your responsibility area may be assigned to <AgentName>.

Scope:
- <path/module>

Acceptance:
- <observable acceptance criteria>

You are not alone in the codebase. Do not revert or overwrite changes made by others. Start by claiming your task in kanban.md. Finish by filling Result/Files/Verification, moving the task to Done, and checking for more assigned tasks or tasks you published that need Review.
```
