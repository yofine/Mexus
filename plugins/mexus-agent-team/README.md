# Mexus Agent Team

Standalone Markdown-only Agent Team plugin for Claude Code and Codex.

This plugin does not require a Mexus server, Mexus panes, Mission Inbox, external A2A messaging, or a dispatch runtime. Coordination happens through ordinary Markdown files in the current project:

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

## Commands

Claude Code plugin skills are always namespaced by the plugin name. This plugin uses the `mexus-skill` namespace.

```text
/mexus-skill:team "<request>"        Create or continue a Markdown-backed Agent Team Mission.
/mexus-skill:run                     Execute the next kanban tasks with background Agents.
/mexus-skill:roundtable "<topic>"    Open a RoundTable proposal for a shared decision.
/mexus-skill:board                   Start a read-only Web board for agent-team/.
/mexus-skill:team-status             Print a concise Mission summary.
/mexus-skill:team-stop               Stop the local board process.
```

## Claude Code Session-Only Usage

Use this when you only want to load the local plugin for the current Claude Code session.

From any project directory:

```bash
claude --plugin-dir /absolute/path/to/mexus-agent-team
```

Then run:

```text
/mexus-skill:team "Build a small demo feature"
/mexus-skill:run
/mexus-skill:roundtable "Decide the API boundary"
/mexus-skill:board
/mexus-skill:team-status
```

`--plugin-dir` loads a session-only plugin. It may not appear as an installed plugin in `/plugin list`; use `/help` or invoke `/mexus-skill:team` to verify the loaded skills.

If `/mexus-skill:team` is not found:

```bash
claude plugin validate /absolute/path/to/mexus-agent-team
claude --plugin-dir /absolute/path/to/mexus-agent-team --debug-file /tmp/mexus-skill-debug.log
```

The debug log should contain:

```text
Loaded inline plugin from path: mexus-skill
Loaded skills from plugin mexus-skill default directory
```

Do not pass `--disable-slash-commands`.

## Claude Code Local Marketplace Install

Use this when you want Claude Code to install the local plugin through a local marketplace entry. The marketplace file is inside this plugin directory at `.claude-plugin/marketplace.json`, so add the plugin directory itself as the marketplace path:

```bash
claude plugin marketplace add /absolute/path/to/mexus-agent-team
claude plugin install mexus-skill@mexus-skill
claude plugin list
```

Then start Claude Code normally from any project directory and invoke:

```text
/mexus-skill:team "Build a small demo feature"
```

If installation cannot find the marketplace file, make sure the path points at:

```text
/absolute/path/to/mexus-agent-team/.claude-plugin/marketplace.json
```

Do not pass the parent `plugins/` directory unless that parent contains its own `.claude-plugin/marketplace.json`.

To update after editing this local plugin, reinstall or remove/install it again:

```bash
claude plugin uninstall mexus-skill
claude plugin install mexus-skill@mexus-skill
```

## Claude Code Marketplace Shape

This directory also carries `.claude-plugin/marketplace.json`, following the Waza-style layout:

- bundle entry `mexus-skill`, source `./`, registers every skill under `/mexus-skill:*`;
- per-skill entries such as `mexus-skill-team`, source `./skills/team`, for future single-skill installs.

For local development, keep using `--plugin-dir` against this directory. For distribution, publish this directory or its future standalone repository as a Claude Code marketplace and install the bundle entry.

## Typical Workflow

1. Start Claude Code in your project.
2. Create a Mission:

   ```text
   /mexus-skill:team "Implement the feature or fix"
   ```

3. Open the board:

   ```text
   /mexus-skill:board
   ```

   The board is read-only. It shows Mission Plan, Kanban, Agents, Squad Lead Log, and RoundTable.

4. Execute work from the active Mission:

   ```text
   /mexus-skill:run
   ```

5. Open a RoundTable proposal when a shared decision is needed:

   ```text
   /mexus-skill:roundtable "Choose the API boundary"
   ```

6. Check status or stop the board:

   ```text
   /mexus-skill:team-status
   /mexus-skill:team-stop
   ```

## Board Access

The board command starts a local Vite board and an API server. By default it binds to `0.0.0.0` so it can be opened from another machine if your network allows it.

Useful options:

```text
/mexus-skill:board --host 0.0.0.0
/mexus-skill:board --host 0.0.0.0 --public-host <lan-ip-or-hostname>
```

If the browser still shows stale content after plugin edits, stop and restart the board:

```text
/mexus-skill:team-stop
/mexus-skill:board
```

## Execution Model

`Squad Lead` is a fixed coordination role name and is not part of the execution Agent naming pool. `/mexus-skill:team` creates or continues the Mission, then Squad Lead must leave the Mission with execution Agents and actionable kanban tasks already planned. Squad Lead's decomposition work is not itself a kanban task.

Squad Lead starts Claude Code or Codex background Agents to execute kanban tasks. Background Agents must use names from the `agent-team-mission-workflow` convention, read the Mission files, claim tasks in `kanban.md`, write their own task results back to `kanban.md`, and publish follow-up or clarification tasks when needed. Squad Lead does not fill execution results for another Agent.

Every kanban work item follows publisher acceptance: the task publisher creates the task, the executor completes and self-tests it, then the publisher fills `Review`. Squad Lead also performs overall Mission acceptance; when the Mission is still below expectation, Squad Lead publishes new focused tasks to the responsible Agents. If an executor finds a task outside its responsibility, it reassigns the task when the correct owner is clear, or publishes a clarification task to Squad Lead when ownership is unclear.

Use `/mexus-skill:run` to make the host agent select the next `To Claim` tasks and use the Agent tool to start background Agents in parallel. Use `/mexus-skill:team` only to create or continue Mission setup.

Starting a new Mission archives the previous active Mission. `/mexus-skill:run` uses the current active Mission by default; archived Missions are historical unless explicitly selected by name.

There is no external A2A layer. The kanban file is the communication protocol.

## Roster Maintenance

`agent-team/agents.md` is the repository-level reusable Agent roster. It should be updated from accepted Mission work, not edited as ad-hoc scratch space. The active Mission's `agents.md` and accepted `kanban.md` tasks are the source for durable module ownership, known strengths, and work history.

## Verify Locally

```bash
node tests/standalone-smoke.test.mjs
```

To try it in a temp project:

```bash
mkdir -p /tmp/mexus-agent-team-demo
cd /tmp/mexus-agent-team-demo

node /absolute/path/to/mexus-agent-team/scripts/start-mission.mjs \
  --root "$PWD" \
  --name demo-mission \
  --request "Build a small demo feature"

node /absolute/path/to/mexus-agent-team/scripts/status.mjs --root "$PWD" --name demo-mission
node /absolute/path/to/mexus-agent-team/scripts/start-board.mjs --root "$PWD" --host 0.0.0.0
```
