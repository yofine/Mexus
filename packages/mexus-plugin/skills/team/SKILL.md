---
name: team
description: Use when a Mexus-launched agent should start or continue an Agent Team Mission using Markdown kanban coordination.
argument-hint: "<request>" [--name <mission-name>]
---

# `/team`

Use this skill when the user invokes `/team "<request>"`.

This is the Mexus-bundled Team entrypoint. It creates or repairs repository-local Agent Team Markdown files, then asks the active runtime to execute through kanban.

## Steps

1. Preserve the user's request exactly enough for the Mission to reason from it.
2. Choose a short Mission name. If the user passes `--name`, use that value. Otherwise derive a stable slug from the request.
3. From the repository root, run:

   ```bash
   node packages/mexus-plugin/scripts/start-mission.mjs --request "<request>" --name <mission-name>
   ```

   If the current working directory is not the Mexus repository, resolve the script from the plugin root and pass `--root "$PWD"`.

4. Read the generated `agent-team/missions/<mission-name>/kanban.md`.
5. Act as Squad Lead for the first task:
   - Claim only one task at a time.
   - Treat the initial task as the first assignment, not the whole future Mission.
   - Publish later tasks in `kanban.md` as the Mission evolves.
   - Prefer the active Mexus runtime for dispatch when it exists; otherwise use the host CLI's subagent mechanism.
6. Tell the user they can run `/board` to watch the kanban.

## Required Prompt Rules

Every agent prompt created by this skill or by the Squad Lead must include:

- The agent name and responsibility at the start.
- The Mission name.
- The current first task.
- A statement that later tasks may be assigned through kanban.
- A rule to prioritize tasks assigned to `To: <AgentName>`.
- A reassignment rule for tasks outside the agent's responsibility.
- A fallback to publish a Squad Lead clarification task if the correct owner is unclear.

## Boundaries

- Do not bypass `kanban.md` for task state.
- Do not overwrite existing Mission files.
- Do not use hidden side conversations as the source of truth.
- Do not require a standalone plugin install; this skill lives in `packages/mexus-plugin`.
