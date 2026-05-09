# Mission: Hub Agent Team Mission MVP

Mission: `hub-agent-team-mission-mvp`

Lifecycle: active

Created by: Squad Lead

Date: 2026-05-06

## Source Design

Primary design document:

```text
design/agent-team/mexus-agent-team-mission-integration.md
```

## Mission Intent

Integrate Agent Team Mission Workflow into Mexus Hub connected workspace view. The integration should let users create and observe Markdown-backed Mission files inside a repository while keeping the Markdown files as the source of truth.

This Mission is Hub-only. It does not design or implement a separate non-Hub layout path.

## Product Positioning

The Team tab is an observation surface, not a task dispatch console.

Mexus should make Mission state visible and recoverable:

- active Mission lifecycle
- Mission overview
- read-only Kanban
- Mission Agent names and responsibilities
- pane-to-Mission association
- pane filtering by Mission and agent type

Mexus should not turn the Team tab into a high-control task runner in the first version.

## Phase 1 Expected Outcome

After Phase 1:

- Hub workspace has a fixed `Team` tab.
- Users can create a Mission from Skill templates.
- One Hub connected workspace has at most one `Lifecycle: active` Mission.
- Team tab shows active Mission overview, Kanban, and Mission Agent responsibilities.
- Kanban is read-only in Team tab and does not expose Claim, Complete, or Review controls.
- Settings can configure the Mission default CLI agent type.
- Creating a Mission can start a Squad Lead pane with the default CLI agent.
- Add Pane can choose an Agent from the active Mission to prefill the form.
- Pane cards show Mission badges.
- Pane list can filter by Mission and agent type.
- Pane title editing persists.

## Strategic Constraints

- Markdown files remain the source of truth.
- Do not add a database for Mission state.
- Do not make the Team tab mutate Kanban task status.
- Do not add Start Pane or Send Prompt controls to Team Agent cards.
- Do not introduce a separate abnormal state model for multiple active Missions; enforce single active Mission through creation and activation flows.
- Do not build Roundtable UI in Phase 1.
- Do not support non-Hub layout entry points in Phase 1.

## Minimum Acceptance Standard

- `agent-team/mission-workflow.md`, `agent-team/agents.md`, and Mission five-file structure exist and follow the Skill.
- Phase 1 backend APIs and config fields can create, discover, activate, and read Missions.
- Hub Team tab can display Mission data without corrupting Markdown if parsing is partial.
- Add Pane can prefill from active Mission Agent data.
- Pane cards and filters make Mission ownership observable.
- Tests or focused verification cover Mission lifecycle, config migration, parsing fallback, and pane title persistence where practical.

## Phase 6 Expected Outcome — Agent Team Plugin

Source design: `design/agent-team/mexus-agent-team-plugin.md` (2026-05-10).

**Underlying goal: Agent self-governance.** The plugin is a means, not the end. The real target is for the Agent Team to govern itself — Squad Lead decides decomposition, dispatches work, reviews outcomes; worker Agents claim, execute, and surface clarifications; collective decisions go through roundtable. Mexus and the plugin only provide the substrate (Panes, Markdown files, inbox notifications, dispatch commands). Whenever a design choice is between "make Mexus smarter" and "give Agents the right primitive to govern themselves", prefer the latter.

Phase 6 introduces a `mexus-agent-team` plugin so Squad Lead has first-class commands for dispatching real Panes (instead of falling back to subAgent tools), and so Mission lifecycle operations (create, activate, archive, agent roster maintenance) are version-aligned with Mexus. These commands exist because they are the minimal substrate Agents need to govern themselves — not because the plugin is the goal.

Goals:

- Eliminate subAgent misuse: Squad Lead's primary dispatch path is `/dispatch <agent-name>`, which creates a real Mexus Pane with `pane.mission` metadata; Phase 5 inbox pipeline auto-injects kanban tasks. Mission tasks must be carried by Panes, not subAgents.
- `/mission-create <name> "<request>"` is a thin shell: it spawns a Squad Lead Pane with the user's raw request as initial task. Mission files (mission/agents/kanban/roundtable/squad-lead) are authored by Squad Lead in conversation, using `references/*-template.md` as concrete reference samples (not as code-filled skeletons).
- Mexus CLI gains `mexus pane create/list/close` and `mexus mission list/active/activate/validate/archive`, backed by REST endpoints (`POST/GET/DELETE /api/panes`). Plugin slash commands shell out to these; CLI is reusable outside the plugin.
- Plugin is on-demand: not bundled into `mexus init`. Team tab in Hub Web shows an "Enable Agent Team" entry point that surfaces `claude /plugin install mexus-agent-team` guidance.
- Phase 5 inbox pipeline is unchanged. `/dispatch` simply attaches `pane.mission.{name,role,agentName}` at create time, and `MissionPaneNotifier` resolves Panes via those fields exactly as today.

Phase 6 MVP slash commands (4 core): `/mission-create`, `/mission-activate`, `/mission-archive`, `/dispatch`.

Phase 6 next-tier commands (3 secondary): `/mission-agent-add`, `/mission-agent-remove`, `/dispatch-list`.

Phase 6 Acceptance:

- A new Mission can be created end-to-end with `/mission-create`, the Squad Lead Pane appears in Mexus, and Squad Lead authors all 5 Mission files with no template copy-paste from the command itself.
- `/dispatch <agent>` reliably creates (or reuses) a Pane with correct `pane.mission` metadata; the kanban-task-assigned event is injected into that Pane's terminal within ~1.5s.
- `/mission-archive` moves the Mission directory under `_archived/`, deactivates if active, and closes Mission Panes (refusing `running` Panes without `--force`).
- During the entire dogfooded run, Squad Lead never invokes Claude Code's `Agent` (subAgent) tool to execute a Mission task — every dispatched task is carried by a real Mexus Pane.
- Plugin install path is reachable from Squad Lead's Pane so it can `Read` the `references/*-template.md` files when authoring Mission files.

## Phase 6 Strategic Constraints

- The plugin is a means; Agent self-governance is the end. Do not add features that move authority from Agents to Mexus or to plugin code. If a behavior can live in Squad Lead's prompt + a primitive command, prefer that over hard-coding it in the server or in the slash command's own logic.
- Plugin is additive; Mexus's core Pane/PTY value remains usable without it.
- CLI implementation lives in Mexus main repo, not duplicated inside the plugin. The plugin's slash commands are thin shells over `mexus` CLI.
- `/mission-create` does not generate Mission file skeletons. The 5 template files in `references/` are reference samples for Squad Lead to read and emulate, not for the command to copy.
- Phase 5 inbox pipeline contracts are not modified. The new pipeline only depends on `pane.mission` fields that already exist.
- No multi-Mission concurrent-active support in this Phase. Single active Mission per workspace.
- No standalone (non-Mexus) plugin runtime. Plugin requires a running Mexus instance.
