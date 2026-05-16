---
name: board
description: Use when a Mexus-launched agent should show a local Web board for repository Agent Team Mission files.
argument-hint: ""
---

# `/board`

Use this skill when the user invokes `/board`.

This skill owns the Agent Team Web board. The board is observational in phase one: it reads `agent-team/` from the current project and renders Mission kanban state without editing tasks.

## Steps

1. Verify the current project has `agent-team/`. If not, tell the user to run `/team "<request>"` first.
2. Resolve the plugin root from the current skill path or from the Mexus plugin package path.
3. Ensure board app dependencies are available in:

   ```text
   packages/mexus-plugin/skills/board/board-app/
   ```

4. Start the board server:

   ```bash
   node packages/mexus-plugin/scripts/start-board.mjs --root "$PWD"
   ```

5. Print the local URL reported by the script.

## Board Contract

- Read the caller project's `agent-team/`, not files inside the plugin.
- Render Mission selector, overview, kanban columns, task cards, and agent summary.
- Poll or refresh file state without requiring a Mexus server.
- Do not write task changes in phase one.
- If the port is busy, the script may choose the next available API port; the Vite app port should remain visible in output.
