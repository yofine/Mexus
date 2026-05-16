# Mexus Built-In Team Plugin Design

Status: draft
Date: 2026-05-16

## Goal

Add Agent Team capability to `packages/mexus-plugin/`, the plugin package Mexus already loads into agent CLIs.

This is the Mexus-bundled track. It is not a replacement for the future standalone `plugins/mexus-agent-team/` track. The built-in track ships with Mexus and can assume Mexus may load it through `--plugin-dir`; the standalone track will later be packaged for CC/Codex users who do not run Mexus.

## Package Boundary

Location:

```text
packages/mexus-plugin/
```

Existing responsibility:

- Hook bridge from agent CLI back to Mexus.
- Current implemented hook: `SessionStart` session binding.

New Team responsibility:

- Provide short Team skills: `/team`, `/board`, `/team-status`, `/team-stop`.
- Carry Agent Team reference templates.
- Carry a local Web board skill with its own Vite app.
- Provide small Node scripts for Mission file creation, status, board start, and board stop.

The existing hook files must remain independent. Team skills should not break session binding when the board or Mission scripts fail.

## Commands

```text
/team "<request>"   Create or continue an Agent Team Mission in agent-team/.
/board              Start the local Web Kanban board.
/team-status        Print kanban counts and task summary.
/team-stop          Stop the board process.
```

## Runtime Model

`/team` writes Markdown files into the caller project:

```text
agent-team/
├── mission-workflow.md
├── agents.md
└── missions/<mission-name>/
    ├── mission.md
    ├── agents.md
    ├── kanban.md
    ├── roundtable.md
    └── squad-lead.md
```

The first Mission task is assigned to `Squad Lead`. It is intentionally a planning/decomposition task. Later tasks are published into `kanban.md` as the Mission evolves.

Execution uses the active runtime:

- In Mexus, later iterations can dispatch real panes.
- In ordinary Claude Code plugin use, the lead can use host subagents.
- In both cases, `kanban.md` remains the source of truth.

## Web Board Skill

`skills/board/` owns the board:

```text
skills/board/
├── SKILL.md
└── board-app/
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    └── src/
```

The board starts from `/board` through `scripts/start-board.mjs`.

It runs:

- a tiny local JSON API reading the caller project's `agent-team/`;
- the skill-local Vite app for presentation.

Phase one is read-only. The board renders Mission selector, overview counts, kanban columns, task cards, and agent summary. It does not mutate task state.

## Files Added In Phase One

```text
packages/mexus-plugin/
├── references/
├── scripts/
│   ├── start-mission.mjs
│   ├── start-board.mjs
│   ├── status.mjs
│   └── stop-board.mjs
├── skills/
│   ├── team/SKILL.md
│   ├── board/SKILL.md
│   ├── team-status/SKILL.md
│   └── team-stop/SKILL.md
└── tests/team-plugin-smoke.test.mjs
```

## Validation

Run:

```bash
pnpm --filter @mexus/plugin test
```

This verifies:

- existing plugin manifest and hook files still exist;
- Team skills and references exist;
- `start-mission.mjs` creates all required Mission files;
- `status.mjs` parses the generated kanban.

Board build validation is separate because it depends on installing the skill-local Vite app dependencies:

```bash
pnpm --dir packages/mexus-plugin/skills/board/board-app install
pnpm --dir packages/mexus-plugin/skills/board/board-app build
```

## Follow-Up

- Wire the built-in Team skills into whatever discovery mechanism Claude Code exposes for plugin-carried skills.
- Decide whether Mexus should expose `/team` as a pane command or rely on the agent CLI skill system.
- Add Mexus-aware pane dispatch only after the Markdown-first flow is stable.
- Keep the standalone plugin track simple until it is split into a separate repository.

