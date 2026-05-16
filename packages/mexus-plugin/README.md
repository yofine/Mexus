# @mexus/plugin

Mexus' built-in **runtime bridge plugin** — loaded into the agent CLI by the Mexus server so the CLI can report its own lifecycle back to Mexus. One plugin package, multiple capabilities, grown over time.

## Capabilities

| Capability | Hook | Status |
|---|---|---|
| Bind `session_id` to a Mexus pane on startup | `SessionStart` | ✅ implemented |
| Start Agent Team Missions from `/team` | Skill + script | ✅ initial |
| Show Agent Team Kanban with `/board` | Skill + Vite app | ✅ initial |
| Summarize and stop Team board | Skill + script | ✅ initial |
| Report tool-use activity (edits, bash, etc.) | `PreToolUse` / `PostToolUse` | 🚧 planned |
| Report final cost / turn count on exit | `SessionEnd` | 🚧 planned |
| Forward agent errors to pane status | TBD | 🚧 planned |

For each capability the plugin owns the hook script and the wire format; the Mexus server owns the receiving endpoints under `/api/internal/*`.

## How Mexus loads it

When `PtyManager.spawn` starts a `claudecode` pane it:

1. Generates a one-shot bind token for the pane.
2. Appends `--plugin-dir <abs-path-to-this-package>` to the `claude` command.
3. Injects per-pane env into the PTY:

| Var | Meaning |
|---|---|
| `MEXUS_PANE_ID` | Mexus-side pane identifier |
| `MEXUS_BIND_URL` | e.g. `http://127.0.0.1:7700/api/internal/session-bind` |
| `MEXUS_BIND_TOKEN` | one-shot token authenticating this pane's hook calls |
| `MEXUS_PLUGIN_DEBUG` | set to `1` to enable diagnostic logging |

Claude Code loads the plugin **for that process only** — the user's global `~/.claude/settings.json` is untouched.

The same plugin package is intended to grow adapters for other agents (Codex etc.) once their hook surface is mapped.

## Package layout

```
.claude-plugin/plugin.json      # Claude Code plugin manifest
hooks/
  hooks.json                    # SessionStart -> session-start.sh
  session-start.sh              # POSTs {paneId, sessionId, agent, source} to Mexus
references/                     # Agent Team Markdown protocol and templates
scripts/
  start-mission.mjs             # creates/repairs agent-team Mission files
  start-board.mjs               # starts local board API + Vite app
  status.mjs                    # summarizes kanban
  stop-board.mjs                # stops board process metadata
skills/
  team/SKILL.md                 # /team
  board/SKILL.md                # /board and board-app owner
  team-status/SKILL.md          # /team-status
  team-stop/SKILL.md            # /team-stop
README.md
package.json                    # @mexus/plugin (monorepo membership only)
```

## Agent Team commands

The built-in Team skills are intended for agent CLIs launched with this plugin.

```text
/team "<request>"   Create or continue an Agent Team Mission in agent-team/.
/board              Start the local Web Kanban board for agent-team/.
/team-status        Print kanban counts and outstanding tasks.
/team-stop          Stop the local board process.
```

The Markdown files under `agent-team/` remain the source of truth. The board is read-only in the first version.

## Standalone test

```bash
# 1. Start a mock bind server
node -e 'require("http").createServer((q,r)=>{let b="";q.on("data",c=>b+=c);q.on("end",()=>{console.log(q.method,q.url,b);r.end("{}")})}).listen(17700)'

# 2. Run Claude with the plugin
MEXUS_PANE_ID=test-1 \
MEXUS_BIND_URL=http://127.0.0.1:17700/api/internal/session-bind \
MEXUS_BIND_TOKEN=dev-token \
MEXUS_PLUGIN_DEBUG=1 \
claude --plugin-dir "$PWD/packages/mexus-plugin" -p "say only OK"

# 3. Confirm the bind POST shows up on the mock server.
#    Debug log: /tmp/mexus-plugin.log (only when MEXUS_PLUGIN_DEBUG=1)
```

## Team smoke test

```bash
pnpm --filter @mexus/plugin test
```

This checks the skill structure and verifies `start-mission.mjs` can create a valid Mission in a temporary project.

## Contract guarantees

- **Hooks always `exit 0`** — a missing or unreachable Mexus server must never break the agent.
- **No hard dependency on `jq`** — falls back to a `sed`-based parse so the plugin works on minimal user machines.
- **All endpoints are localhost-only** and gated by one-shot tokens.
- **Debug logging is off by default** — production runs leave no log files.

## Verified against

- Claude Code `2.1.111` — `--plugin-dir` flag and `SessionStart` hook with stdin JSON input.

## Design

See `design/session-id-via-plugin-hook.md` for the rationale and the broader plan for adding further hooks.
