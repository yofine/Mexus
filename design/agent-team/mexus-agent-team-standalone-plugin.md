# Mexus Agent Team Plugin Tracks

Status: draft
Date: 2026-05-16

## Goal

Build Agent Team as two related plugin tracks exported by Mexus:

1. **Mexus-bundled plugin capabilities** inside `packages/mexus-plugin/`.
   These are loaded when Mexus starts an agent CLI. They can integrate with Mexus runtime state, panes, hooks, and future internal endpoints.

2. **Standalone Agent Team plugin** under `plugins/mexus-agent-team/`.
   This is for Claude Code and Codex users who want the Agent Team mechanism without a running Mexus server. It coordinates host CLI subagents through Markdown and provides a local Web board.

These tracks are not replacements for each other. They share the same Agent Team Markdown protocol and reference templates, but they have different runtime contracts.

For now, keep both tracks in this repository for simplicity. The standalone track can be split into its own repository later, but phase one should not add extra packaging or release complexity for that future move.

## Track Split

### Track A: Mexus-Bundled Team Plugin

Location:

```text
packages/mexus-plugin/
```

Purpose:

- Ship capabilities used together with Mexus.
- Run inside agent CLIs launched by Mexus.
- Reuse the existing `.claude-plugin` package and hook mechanism.
- Add Team-related skills and board assets that are intended to work with a Mexus workspace.

Runtime assumptions:

- Mexus may be running.
- Mexus can inject env vars and plugin paths when spawning panes.
- The plugin may call Mexus localhost endpoints when a feature explicitly depends on runtime state.
- It can coexist with the existing session binding hook.

This track should eventually host the Mexus-integrated Team plugin because the user installed or ran Mexus and expects Mexus-backed behavior.

### Track B: Standalone Agent Team Plugin

Location:

```text
plugins/mexus-agent-team/
```

Purpose:

- Let Claude Code and Codex users start an Agent Team Mission from a short slash command.
- Coordinate host CLI subagents through the Mexus Agent Team Markdown protocol.
- View the Mission Kanban in a local Web board.
- Work without Mexus panes, Mission Inbox, Hub mode, or Mexus Web.

Runtime assumptions:

- Mexus does not need to be installed or running.
- Execution belongs to the host CLI and its own subagent system.
- State lives in `agent-team/` Markdown files.

## Product Shape

Shared short slash commands:

```text
/team "<request>"   Start or continue an Agent Team Mission.
/board              Start or open the local Web Kanban board.
/team-status        Print active Mission, task counts, and board URL.
/team-stop          Stop the board preview service.
```

`/team` is the primary entry because it is short and natural in both Claude Code and Codex. The plugin name can remain `mexus-agent-team` for discovery and packaging, but daily usage should avoid long prefixes.

## Core Principles

1. Keep the two plugin tracks explicit.
   `packages/mexus-plugin/` is the Mexus-bundled capability package. `plugins/mexus-agent-team/` is the standalone package. They share protocol assets but should not silently overwrite each other.

2. Kanban is the collaboration source of truth.
   Agent work is coordinated through `agent-team/missions/<mission>/kanban.md`. Subagents claim tasks, update status, record results, and publish follow-up work by editing Markdown.

3. Execution belongs to the active runtime.
   In the standalone track, Claude Code and Codex run their own subagents. In the Mexus-bundled track, Team behavior may integrate with Mexus panes and runtime state when explicitly designed, but the Markdown Kanban remains the coordination layer.

4. The board is observational first.
   The first Web board should read Mission files and render state. It should avoid rich mutation controls until the read path is reliable and the Markdown protocol is stable.

5. The workflow stays portable.
   Mission files remain ordinary Markdown. A repo can be used without the board, and the board can be restarted from files alone.

## Standalone Plugin Directory

```text
plugins/mexus-agent-team/
├── .codex-plugin/
│   └── plugin.json
├── README.md
├── skills/
│   ├── team/
│   │   └── SKILL.md
│   ├── board/
│   │   ├── SKILL.md
│   │   └── board-app/
│   │       ├── package.json
│   │       ├── vite.config.ts
│   │       ├── index.html
│   │       └── src/
│   │           ├── App.tsx
│   │           ├── agentTeamApi.ts
│   │           ├── kanbanParser.ts
│   │           └── styles.css
│   ├── team-status/
│   │   └── SKILL.md
│   └── team-stop/
│       └── SKILL.md
├── references/
│   ├── mission-workflow.md
│   ├── mission-template.md
│   ├── agents-template.md
│   ├── kanban-template.md
│   ├── roundtable-template.md
│   └── squad-lead-template.md
├── scripts/
│   ├── start-mission.mjs
│   ├── status.mjs
│   └── stop-board.mjs
```

The `skills/board/` directory is the Web board skill. It owns and carries the Vite frontend under `skills/board/board-app/`. This keeps the board as a portable skill payload rather than a separate top-level app. The board app reads the user's current project `agent-team/` directory through a local preview server endpoint, not through Mexus.

## Mexus-Bundled Plugin Directory

`packages/mexus-plugin/` already exists as Mexus' runtime bridge plugin. Team capabilities should be added there without replacing the existing hook work.

Target shape:

```text
packages/mexus-plugin/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   ├── hooks.json
│   └── session-start.sh
├── skills/
│   ├── team/
│   │   └── SKILL.md
│   ├── board/
│   │   ├── SKILL.md
│   │   └── board-app/
│   ├── team-status/
│   │   └── SKILL.md
│   └── team-stop/
│       └── SKILL.md
├── references/
│   ├── mission-workflow.md
│   ├── mission-template.md
│   ├── agents-template.md
│   ├── kanban-template.md
│   ├── roundtable-template.md
│   └── squad-lead-template.md
├── scripts/
│   ├── start-mission.mjs
│   ├── status.mjs
│   └── stop-board.mjs
├── README.md
└── package.json
```

The Mexus-bundled copy should use the same user-facing short commands. It may add Mexus-specific behavior later, but phase one should keep parity with the standalone behavior unless a Mexus integration is explicitly required.

## Slash Commands And Skills

### `/team "<request>"`

Purpose: start a Mission from the current CLI session.

Responsibilities:

- Choose or ask for a Mission name.
- Create `agent-team/mission-workflow.md` if missing.
- Create `agent-team/agents.md` if missing.
- Create `agent-team/missions/<mission>/` with:
  - `mission.md`
  - `agents.md`
  - `kanban.md`
  - `roundtable.md`
  - `squad-lead.md`
- Seed a small initial kanban that lets the host CLI's lead agent decompose work.
- Tell Claude Code or Codex that its own subagents must work through kanban tasks, not through hidden side conversations.
- Encourage starting `/board` after the Mission files exist.

The initial prompt must include:

- The lead identity and Mission name.
- The user's original request.
- A clear statement that the first task is only the first assignment, and later tasks may be assigned as the Mission evolves.
- The kanban-first rule.
- The reassignment rule when a task is outside an agent's responsibility.
- The Squad Lead clarification fallback when the correct owner is unclear.

The command should not depend on Mexus being installed or running.

### `/board`

Purpose: run the Web Kanban board carried by the plugin.

Responsibilities:

- Locate the current project root.
- Verify an `agent-team/` directory exists.
- Resolve the skill-local frontend at `plugins/mexus-agent-team/skills/board/board-app/`.
- Install or verify the board app dependencies only inside that skill-local app directory.
- Start the board skill's Vite preview/dev server.
- Expose a local file API that reads:
  - `agent-team/mission-workflow.md`
  - `agent-team/agents.md`
  - `agent-team/missions/*/mission.md`
  - `agent-team/missions/*/agents.md`
  - `agent-team/missions/*/kanban.md`
  - `agent-team/missions/*/roundtable.md`
  - `agent-team/missions/*/squad-lead.md`
- Print the local URL.

The first board is read-only. It may poll the file API every 1-2 seconds or use a simple file watcher inside the local server. Polling is acceptable for the first version because the dataset is small and avoids platform-specific watcher behavior.

#### Board Web Skill Payload

`skills/board/SKILL.md` is not only a command wrapper. It is the owner of the Web Kanban experience.

It must include:

- Instructions for launching the board from the current project.
- The skill-local Vite app in `skills/board/board-app/`.
- A script path or command for starting the board server.
- A clear rule that the board reads the caller project's `agent-team/`, not files inside the plugin.
- A clear rule that phase one is observational and should not write task changes.

This separation matters because `/team` creates and operates Mission files, while `/board` owns presentation. A user can restart or share the board skill without re-running Mission creation.

### `/team-status`

Purpose: provide a terminal summary when the board is not visible.

Responsibilities:

- Detect the active or newest Mission.
- Parse `kanban.md`.
- Print counts for `To Claim`, `In Progress`, and `Done`.
- Print outstanding tasks grouped by `To`.
- Print the board URL if a board process is known to be running.

### `/team-stop`

Purpose: stop the board service.

Responsibilities:

- Stop only the plugin-managed board process.
- Do not delete `agent-team/`.
- Do not modify Mission files.

## Board UX

The board should be a functional work surface, not a marketing page.

First screen:

- Mission selector.
- Compact overview row:
  - Mission name.
  - Goal summary.
  - Counts by status.
  - Last file update time.
- Kanban as the primary area:
  - `To Claim`
  - `In Progress`
  - `Done`
- Agent summary below or beside the board:
  - Agent name.
  - Responsibility.
  - Task counts.

Card content:

- Ref.
- To / From.
- Scope.
- Request.
- Updated.
- Review indicator.

No task mutation controls in phase one. The board observes Markdown state; agents and users still edit files through the CLI.

## Data Model

Mission path:

```text
agent-team/missions/<mission-name>/
```

Required files:

```text
mission.md
agents.md
kanban.md
roundtable.md
squad-lead.md
```

Kanban task shape remains the existing protocol:

```md
To: Agent-X | From: Agent-Y | Scope: path/or/module
- Ref: short-id
- Request: concrete request
- Reason: why this is needed
- Acceptance: observable criteria
- Result:
- Files:
- Verification:
- Review:
- Updated:
```

The parser should be tolerant:

- Missing optional fields become empty strings.
- Unknown fields are preserved only in raw task text.
- Missing status sections return a clear board warning instead of crashing.
- Duplicate refs render as separate cards and include source line numbers internally.

## Host CLI Execution Model

The plugin does not know whether it is running in Claude Code or Codex beyond what the host exposes through skills and slash commands.

The `/team` skill should instruct the current lead agent to use available host subagent mechanisms to assign work. The lead's responsibility is to:

1. Create or update kanban tasks.
2. Dispatch subagents with the relevant task block and the required Agent identity.
3. Require subagents to edit `kanban.md` as the source of truth.
4. Review completed tasks where `From` is the lead or where the lead owns the acceptance standard.

Each worker subagent must:

1. Read the workflow, Mission files, and its task.
2. Claim one assigned task by moving it to `In Progress`.
3. Work only within the task's scope.
4. Record `Result`, `Files`, `Verification`, and `Updated`.
5. Move the task to `Done`.
6. Publish follow-up tasks instead of crossing scope boundaries.

## Local Board Server

The board needs two pieces:

1. Skill-local Vite frontend for rendering.
2. Minimal local file API for reading the current project's `agent-team/`.

Preferred implementation:

- A Node script launched by `skills/board/SKILL.md` starts a tiny HTTP server for `/api/agent-team`.
- The same script runs the skill-local Vite app in middleware mode or starts Vite on a known port.
- The script writes process metadata to `.agent-team/board.json` or `.mexus-agent-team/board.json` in the current project:

```json
{
  "pid": 12345,
  "url": "http://127.0.0.1:4179",
  "projectRoot": "/path/to/project",
  "startedAt": "2026-05-15T00:00:00.000Z"
}
```

Use a plugin-specific hidden directory rather than `.nexus/` because this plugin must not imply a Mexus runtime dependency.

## Error Handling

`/team`:

- If `agent-team/missions/<name>/` exists, continue the Mission instead of overwriting files.
- If required files are missing, repair only missing files and report what was created.
- If a dirty kanban cannot be parsed, keep raw content and ask the lead to normalize the malformed task block.

`/board`:

- If `agent-team/` is missing, tell the user to run `/team "<request>"` first.
- If dependencies are not installed, run the narrow install command for `plugins/mexus-agent-team/skills/board/board-app/`.
- If the default port is busy, choose the next available port and print it.
- If file reads fail, render an error state in the board and keep the server alive.

`/team-stop`:

- If no metadata file exists, report that no board process is known.
- If the process is already gone, remove stale metadata.

## Testing

Plugin smoke tests:

- Manifest exists at `.codex-plugin/plugin.json`.
- Skills exist for `team`, `board`, `team-status`, and `team-stop`.
- Skill frontmatter has `name` and `description`.
- Reference files exist.

Mission generation tests:

- `/team` script creates all required files in a temp repo.
- Existing files are not overwritten.
- Initial kanban parses successfully.

Parser tests:

- Parse all three status sections.
- Parse duplicate refs with separate line numbers.
- Tolerate missing optional fields.
- Return warnings for malformed files.

Board tests:

- Vite app builds.
- API reads a fixture `agent-team/`.
- Board renders counts and cards from fixture data.

Manual acceptance:

1. In a fresh repo, install or point Codex/Claude Code at `plugins/mexus-agent-team/`.
2. Run `/team "build a small feature"`.
3. Run `/board`.
4. Confirm the board opens and shows the generated Mission.
5. Ask the host CLI to run at least two subagents.
6. Confirm kanban updates appear on the board without restarting it.

## Phase One Tasks

1. Scaffold `plugins/mexus-agent-team/` with `.codex-plugin/plugin.json`.
2. Add `README.md`.
3. Copy current Agent Team workflow references into `references/`.
4. Add `skills/team/SKILL.md`.
5. Add `skills/board/SKILL.md`.
6. Add `skills/team-status/SKILL.md`.
7. Add `skills/team-stop/SKILL.md`.
8. Implement `scripts/start-mission.mjs`.
9. Implement `scripts/status.mjs`.
10. Implement `scripts/stop-board.mjs`.
11. Scaffold `board/` as a small Vite app.
12. Implement board file API.
13. Implement board kanban parser.
14. Implement board Mission selector, overview, kanban columns, and agent summary.
15. Add smoke tests for plugin structure.
16. Add parser and mission generation tests.
17. Build the board app.
18. Run an end-to-end manual Mission in a temp repo.

## Non-Goals

- No Mexus Pane creation.
- No Mexus Hub integration.
- No Mission Inbox pipeline.
- No hidden scheduler.
- No rich board editing controls in phase one.
- No dependency on a running Mexus server.
