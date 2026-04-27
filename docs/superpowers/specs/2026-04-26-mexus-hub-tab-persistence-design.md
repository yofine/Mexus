# Mexus Hub Tab Persistence Design

## Summary

Mexus Hub server tabs should be readable at a glance and survive browser reloads. This is UI state owned by the Hub frontend, not server lifetime or workspace pane state.

## Scope

- Server tab labels show status, project name, port, and a short project path hint.
- Server tab tooltips expose full cwd, status, pid, and port for disambiguation.
- Open server tabs persist in browser localStorage.
- The active tab and connected tab restore after reload when their referenced server records still exist.
- If a restored server exists but is stopped, the tab remains open in disconnected state and does not reconnect.
- Removed server records are filtered from restored tabs.

## Architecture

- Add a small Hub tab state helper module under `packages/web/src/lib/` for serialization, restore, and label formatting rules.
- Keep React component state in `HubApp.tsx`, but use the helper module for all persistence decisions.
- Store only stable identifiers in localStorage: open server ids, active tab id, connected tab id, and settings tab state. Current display metadata continues to come from Hub instance records.

## Storage

localStorage key: `mexus.hub.tabs.v1`

Stored shape:

```json
{
  "openServerIds": ["local:7700"],
  "activeTabId": "tab:local:7700",
  "connectedTabId": "tab:local:7700",
  "settingsTabOpen": false
}
```

## Error Handling

Invalid or old localStorage payloads are ignored. Restore falls back to the dashboard tab. Persistence failures are ignored because tab state is convenience state.
