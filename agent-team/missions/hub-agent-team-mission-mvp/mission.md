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
