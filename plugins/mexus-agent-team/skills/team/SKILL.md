---
name: team
description: Use when starting or continuing a Markdown-only Agent Team Mission with Claude Code or Codex background Agents and no Mexus server.
argument-hint: "\"<request>\" [--name <mission-name>]"
---

# `/mexus-skill:team`

Use this skill when the user invokes `/mexus-skill:team "<request>"`.

This is a standalone Agent Team workflow. It must not call `mexus`, create panes, use Mission Inbox, or rely on external A2A messaging. Communication happens through `agent-team/` Markdown files, especially `kanban.md`.

Starting a Mission makes it the only active Mission in the workspace. Any previous active Mission is archived by changing its `mission.md` lifecycle to `Lifecycle: archived`.

## Start Or Continue

1. Preserve the user's request.
2. Choose a Mission name from `--name` or derive a short slug.
3. Run the standalone script from this plugin:

   ```bash
   node <plugin-root>/scripts/start-mission.mjs --root "$PWD" --name <mission-name> --request "<request>"
   ```

4. Read:
   - `agent-team/mission-workflow.md`
   - `agent-team/missions/<mission-name>/mission.md`
   - `agent-team/missions/<mission-name>/agents.md`
   - `agent-team/missions/<mission-name>/kanban.md`
   - `agent-team/missions/<mission-name>/roundtable.md`
5. Act as Squad Lead.
6. Immediately refine the generated `agents.md` and `kanban.md` so the Mission has the right execution Agents and actionable worker tasks before you report back to the user.

## Execution Rules

- `Squad Lead` is a fixed coordination role name. Do not rename it, and do not consume one of the execution Agent names for Squad Lead.
- Squad Lead decomposition work is not a kanban task. `/mexus-skill:team` must finish with a planned roster and planned kanban tasks for execution Agents.
- Treat `agent-team/agents.md` as the long-term repository roster. Reuse existing Agents when their module history fits, and add new Agents only when no close owner exists.
- Use Claude Code or Codex background Agents for worker execution.
- Every execution Agent must be named according to `agent-team-mission-workflow`: short stable names from the Ars Goetia / Lesser Key of Solomon name set.
- Do not use external A2A, inbox, pane dispatch, or Mexus runtime features.
- Kanban is the communication protocol.
- Kanban task `From` must be Squad Lead or an executing Agent, never `User`.
- Dispatch one scoped task per background Agent.
- The executing background Agent, not the Squad Lead, must move and update its own kanban task block.
- Every background Agent must update `kanban.md` with status, Result, Files, Verification, and Updated before reporting back.
- Every task is accepted by its publisher: the Agent named in `From` reviews the completed task and fills `Review`.
- Squad Lead owns mission-level acceptance. If the overall result is below expectation, publish new focused tasks to the responsible Agents instead of editing another Agent's completed result.
- If a task is outside an Agent's scope and the correct owner is clear, reassign it in `kanban.md` with the reason in `Updated`.
- If task ownership is unclear, publish a clarification task to the Squad Lead.
- Use the Agent tool to start background Agents in parallel for independent kanban tasks.
- Use `roundtable.md` for decisions that affect multiple Agents, shared interfaces, mission scope, product direction, sequencing, acceptance criteria, or major risk trade-offs.
- Review Done tasks before declaring the Mission complete.

## Prompt Requirements For Background Agents

Every background Agent prompt must include:

- Mission name.
- Agent name and responsibility.
- The exact current task block.
- Scope boundary.
- Requirement to read Mission files.
- Requirement to claim, update, and complete its own task block in `kanban.md`.
- Requirement to self-test before moving the task to `Done`.
- Requirement to leave `Review` for the task publisher.
- Reassignment and Squad Lead clarification rules for responsibility mismatch.
- Statement that this is the first/current task, not all future work.
- No external A2A or Mexus dependency.

## Output

After creating or continuing the Mission, tell the user:

- Mission name.
- Files created or reused.
- Previous Missions archived, if any.
- Execution Agents planned and the kanban tasks published for them.
- That `/mexus-skill:board` can open a local read-only board.
