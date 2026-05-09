# Agent Roster

This file is the repository-level roster of reusable agents.

It is not a mission assignment file. Mission-specific squads live in:

```text
agent-team/missions/<mission-name>/agents.md
```

Use this roster when starting a new Mission to decide whether an existing agent should be reused based on module ownership, work history, and demonstrated context.

## Usage Rules

- Keep agent names stable across Missions.
- Agent names are communication handles chosen from the Ars Goetia / Lesser Key of Solomon name set.
- Agent names must not encode current tasks.
- Add a new agent only when no existing agent has a close module history or responsibility fit.
- Update `Work History` after a Mission assigns meaningful work to the agent.
- Do not put mission-specific activation prompts here; those belong in the mission's `agents.md`.

## Agent Profile Format

```md
## AgentName

Primary modules:
- `path/or/module`

Known strengths:
- <Reusable capability>

Work history:
- <YYYY-MM-DD> | `<mission-name>` | <role or workstream> | <status/result>

Notes:
- <Long-term coordination note>
```

## Bael

Primary modules:
- `.claude/skills/agent-team-mission-workflow/`
- `agent-team/`
- `packages/server/src/mission/`
- `packages/server/src/index.ts`

Known strengths:
- Mission template source integration.
- Mission file creation and lifecycle service boundaries.
- REST API shape for Markdown-backed repository features.

Work history:
- 2026-05-06 | `hub-agent-team-mission-mvp` | Mission templates, lifecycle service, and REST APIs | Assigned initial Phase 1 backend mission foundation work.

Notes:
- Reuse Bael for future Missions that touch Mission file formats, Skill template integration, or server-side Mission APIs.

## Agares

Primary modules:
- `packages/server/src/types.ts`
- `packages/web/src/types.ts`
- `packages/server/src/workspace/ConfigManager.ts`
- `packages/web/src/components/SettingsDialog.tsx`
- `.nexus/config.yaml`

Known strengths:
- Config schema evolution.
- Global and workspace configuration behavior.
- Settings UI for agent defaults and compatibility-preserving config migration.

Work history:
- 2026-05-06 | `hub-agent-team-mission-mvp` | Mission config fields and default CLI agent setting | Assigned initial Phase 1 config and settings work.

Notes:
- Reuse Agares for future Missions that touch Mexus settings, config persistence, type synchronization, or agent default behavior.

## Vassago

Primary modules:
- `packages/web/src/stores/workspaceStore.ts`
- `packages/web/src/stores/missionStore.ts`
- `packages/web/src/components/EditorTabs.tsx`
- `packages/web/src/components/missions/`

Known strengths:
- Hub workspace UI composition.
- Team tab, Mission dashboard, selector, overview, and observation-first UI structure.
- Zustand store boundaries for workspace and feature state.

Work history:
- 2026-05-06 | `hub-agent-team-mission-mvp` | Hub Team tab, Mission store, selector, and overview | Assigned initial Phase 1 Team surface work.

Notes:
- Reuse Vassago for future Missions that touch Hub workspace tabs, Mission observation UI, or workspace-level product surfaces.

## Samigina

Primary modules:
- `packages/web/src/components/missions/MissionKanban.tsx`
- `packages/web/src/components/missions/MissionAgents.tsx`
- `packages/web/src/stores/missionStore.ts`
- Mission Markdown parsers and parser tests

Known strengths:
- Read-only observability surfaces.
- Markdown task parsing and fallback rendering.
- Agent responsibility summaries and task count derivation.

Work history:
- 2026-05-06 | `hub-agent-team-mission-mvp` | Read-only Kanban and Mission Agent observation | Assigned initial Phase 1 parser and observation work.

Notes:
- Reuse Samigina for future Missions involving Mission observability, safe Markdown parsing, read-only dashboards, or task state summaries.

## Marbas

Primary modules:
- `packages/web/src/components/AddPaneDialog.tsx`
- `packages/web/src/components/AgentPane.tsx`
- `packages/server/src/workspace/WorkspaceManager.ts`
- pane creation and pane title persistence

Known strengths:
- Pane lifecycle integration.
- Pane metadata, creation form defaults, badge display, filters, and title editing.
- Keeping pane UI changes separate from Mission state mutation.

Work history:
- 2026-05-06 | `hub-agent-team-mission-mvp` | Mission-aware pane creation, pane badges, filters, and title editing | Assigned initial Phase 1 pane integration work.

Notes:
- Reuse Marbas for future Missions involving pane behavior, pane metadata, filtering, title editing, or Add Pane workflows.
