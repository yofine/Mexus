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
- `packages/plugin-agent-team/`
- `packages/server/src/ws/handlers.ts`

Known strengths:
- Mission template source integration.
- Mission file creation and lifecycle service boundaries.
- REST API shape for Markdown-backed repository features.
- Mission Inbox event pipeline, watcher orchestration, and pane notifier integration.
- Claude Code plugin skill authoring for Mexus-backed Mission commands.

Work history:
- 2026-05-06 | `hub-agent-team-mission-mvp` | Mission templates, lifecycle service, and REST APIs | Assigned initial Phase 1 backend mission foundation work.
- 2026-05-09 | `hub-agent-team-mission-mvp` | Mission Inbox kanban watcher, inbox persistence, pane notifier, and workspace wiring | Delivered and accepted Phase 5 autonomous wakeup pipeline work.
- 2026-05-10 | `hub-agent-team-mission-mvp` | `packages/plugin-agent-team` skeleton and core/secondary slash command skills | Delivered and accepted Phase 6 plugin MVP command surface.

Notes:
- Reuse Bael for future Missions that touch Mission file formats, Skill template integration, server-side Mission APIs, inbox notification flow, pane wakeup behavior, or Mexus-backed plugin commands.

## Agares

Primary modules:
- `packages/server/src/types.ts`
- `packages/web/src/types.ts`
- `packages/server/src/workspace/ConfigManager.ts`
- `packages/web/src/components/SettingsDialog.tsx`
- `.nexus/config.yaml`
- workspace and global config migration boundaries

Known strengths:
- Config schema evolution.
- Global and workspace configuration behavior.
- Settings UI for agent defaults and compatibility-preserving config migration.
- Separating workspace-local runtime state from user-global configuration.

Work history:
- 2026-05-06 | `hub-agent-team-mission-mvp` | Mission config fields and default CLI agent setting | Assigned initial Phase 1 config and settings work.
- 2026-05-09 | `hub-agent-team-mission-mvp` | Mission Inbox config boundary review | Confirmed inbox state stays workspace-local under `.nexus/mission-inbox.json` and should not extend `mission_defaults`.

Notes:
- Reuse Agares for future Missions that touch Mexus settings, config persistence, type synchronization, agent default behavior, or workspace-vs-global config policy.

## Vassago

Primary modules:
- `packages/web/src/stores/workspaceStore.ts`
- `packages/web/src/stores/missionStore.ts`
- `packages/web/src/components/EditorTabs.tsx`
- `packages/web/src/components/missions/`
- Hub Team tab and Mission observation UI

Known strengths:
- Hub workspace UI composition.
- Team tab, Mission dashboard, selector, overview, and observation-first UI structure.
- Zustand store boundaries for workspace and feature state.
- Read-only inbox badge/API shape design and Mission detail refresh policy.

Work history:
- 2026-05-06 | `hub-agent-team-mission-mvp` | Hub Team tab, Mission store, selector, and overview | Assigned initial Phase 1 Team surface work.
- 2026-05-09 | `hub-agent-team-mission-mvp` | Mission Inbox UI badge API review | Shaped future read-only `{ summary, items }` inbox response and separate `missionStore.inbox` slice.
- 2026-05-10 | `hub-agent-team-mission-mvp` | Mission detail auto-refresh | Assigned periodic selected Mission refresh so kanban observation updates without manual reload.

Notes:
- Reuse Vassago for future Missions that touch Hub workspace tabs, Mission observation UI, read-only badge surfaces, store boundaries, or workspace-level product surfaces.

## Samigina

Primary modules:
- `packages/web/src/components/missions/MissionKanban.tsx`
- `packages/web/src/components/missions/MissionAgents.tsx`
- `packages/web/src/stores/missionStore.ts`
- Mission Markdown parsers and parser tests
- `packages/server/src/mission/missionParsers.ts`
- `packages/server/src/mission/missionParsers.test.ts`

Known strengths:
- Read-only observability surfaces.
- Markdown task parsing and fallback rendering.
- Agent responsibility summaries and task count derivation.
- Server-side kanban and roundtable parser design for watcher consumption.

Work history:
- 2026-05-06 | `hub-agent-team-mission-mvp` | Read-only Kanban and Mission Agent observation | Assigned initial Phase 1 parser and observation work.
- 2026-05-09 | `hub-agent-team-mission-mvp` | Server-side Mission parsers | Delivered and accepted `parseMissionKanban` and `parseMissionRoundtable`, including clarification/question fields and parser tests.

Notes:
- Reuse Samigina for future Missions involving Mission observability, safe Markdown parsing, read-only dashboards, task state summaries, or watcher-safe parser contracts.

## Marbas

Primary modules:
- `packages/web/src/components/AddPaneDialog.tsx`
- `packages/web/src/components/AgentPane.tsx`
- `packages/server/src/workspace/WorkspaceManager.ts`
- pane creation and pane title persistence
- Mission pane metadata and duplicate pane resolution policy

Known strengths:
- Pane lifecycle integration.
- Pane metadata, creation form defaults, badge display, filters, and title editing.
- Keeping pane UI changes separate from Mission state mutation.
- Deterministic pane targeting for Mission Agent and Squad Lead wakeups.

Work history:
- 2026-05-06 | `hub-agent-team-mission-mvp` | Mission-aware pane creation, pane badges, filters, and title editing | Assigned initial Phase 1 pane integration work.
- 2026-05-09 | `hub-agent-team-mission-mvp` | Mission Inbox pane targeting review | Confirmed oldest-pane resolution for duplicate Mission Agent or Squad Lead panes.

Notes:
- Reuse Marbas for future Missions involving pane behavior, pane metadata, filtering, title editing, Add Pane workflows, or Mission Agent pane targeting.
