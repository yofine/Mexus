# Shell Custom Name Design

## Context

Bottom terminal instances are represented as `PaneState` objects with agent `__shell__`.
They already carry a `name` field, and shell creation uses generated names such as
`Shell 1` and `Shell 2`. The WebSocket protocol and server already include a
`pane.rename` client event, a `pane.renamed` server event, and a `WorkspaceManager.renamePane`
method. Agent panes already use that rename path.

The missing user-facing behavior is renaming shell instances from the bottom terminal
shell list.

## Goals

- Let users assign a custom name to each bottom terminal shell.
- Keep generated default names for new shell instances.
- Preserve shell names across browser refreshes and WebSocket reconnects while the
  same server process is running.
- Avoid any measurable impact on terminal output throughput or xterm rendering.
- Reuse existing pane naming and WebSocket patterns instead of adding a shell-only
  state model.

## Non-Goals

- Persist bottom shell instances or their names across server restarts. Current shell
  panes are intentionally not written to workspace config.
- Add project-wide terminal profiles or default naming templates.
- Change agent pane rename behavior.

## User Experience

The bottom terminal instance list shows each shell name as it does today. Users can
rename a shell from the list without opening a separate dialog. The preferred interaction
is inline editing:

- Double-click the shell name, or click a small edit icon beside it.
- The name becomes a compact input in the same row.
- Enter saves, Escape cancels, and blur saves if the name changed.
- Empty or whitespace-only names are rejected by reverting to the previous name.
- Long names are truncated in the list with the full value available via the row title.

The active terminal title continues to read from `PaneState.name`, so it updates from
the same state change as the list row.

## Architecture

The feature uses the existing shared pane rename flow:

1. `BottomTerminal` enters local edit mode for one shell row.
2. On save, the component trims the name and sends:
   `{ type: 'pane.rename', paneId, name }`.
3. `WorkspaceManager.renamePane` validates the name, updates the in-memory pane state,
   updates workspace config for persisted panes where applicable, and emits `onPaneRenamed`.
4. The WebSocket layer broadcasts `{ type: 'pane.renamed', paneId, name }`.
5. `WorkspaceApp` handles `pane.renamed` and calls `workspaceStore.renamePane`.
6. `workspaceStore.renamePane` updates either `panes` or `shellPanes`, depending on
   the pane id/agent, and React updates the affected labels.

No terminal registry, xterm writer, terminal history, PTY manager, or terminal output
event handling changes are required.

## Performance

Terminal output is high-frequency and must stay outside this feature's hot path.
The implementation will keep rename behavior as a low-frequency control-plane event:

- No rename logic in `terminal.output` handling.
- No terminal history rewrites when names change.
- No per-output lookup of shell names.
- Local edit state is scoped to `BottomTerminal`, not global store state.
- Store updates only occur after the server confirms `pane.renamed`.
- The shell row list remains keyed by stable `pane.id`, preventing terminal component
  remounts when a label changes.

The only React rerender caused by a rename should be the normal workspace store update
that changes the pane name. Active xterm instances should remain mounted.

## Validation

Implementation should verify:

- Renaming a shell sends `pane.rename` with the shell pane id and trimmed name.
- A `pane.renamed` event updates the matching shell row and active shell title.
- Empty names are not sent from the UI, and server validation remains the final guard.
- Existing agent pane renaming still works.
- Terminal output remains unaffected while renaming labels.

Focused tests should cover the workspace store rename behavior for shell panes if a
store test already exists, plus type checking/build verification for the UI changes.
