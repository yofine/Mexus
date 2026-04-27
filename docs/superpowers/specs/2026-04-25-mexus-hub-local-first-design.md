# Mexus Hub Local-First Design

## Summary

Mexus Hub becomes the primary UI entrypoint. It manages local Mexus server instances and opens them as Hub-owned tabs, while only one tab holds the active workspace connection at a time.

## Phase 1 Scope

- Hub scans and lists local Mexus server instances.
- Hub can create, start, stop, and remove local instance records.
- Hub owns server tabs. Tabs are UI state, not server lifetime.
- Only one server tab is actively connected at a time.
- Closing an active tab disconnects the workspace and does not auto-switch to another tab.
- Stopping a server keeps its record and open tabs visible in a disconnected state until the user restarts or removes it.

## Architecture

- `packages/server/src/hub/InstanceRegistry.ts` stores persistent local instance records, including stopped records.
- `packages/server/src/hub/index.ts` exposes Hub APIs and serves the SPA frontend.
- `packages/server/src/index.ts` remains the Mexus server backend and exposes CORS-friendly APIs for Hub-origin browser access.
- `packages/web` gains a Hub shell that manages instance CRUD, server tabs, and the active workspace target.
- Existing workspace UI remains the connected workspace surface, but no longer assumes the current page origin is the only backend.

## Frontend Model

- `Server Record`: persisted instance metadata discovered or created by Hub.
- `Server Tab`: Hub UI tab pointing at a server record.
- `Active Connection`: the single currently connected workspace target.

Rules:

- Opening a tab does not require embedding another page.
- Selecting a running tab activates the connection.
- Selecting a stopped tab keeps the tab active but shows a disconnected workspace state.
- Closing the active tab clears the active connection and returns the workspace to an unconnected state.

## Backend Model

Instance registry records include:

- `port`
- `cwd`
- `projectName`
- `pid`
- `startedAt`
- `status`

`status` is persisted as `running` or `stopped`.

## Migration

- Remove the inline Hub HTML dashboard and iframe tabs.
- Serve the existing web bundle from Hub mode too.
- Detect Hub mode in the frontend via a Hub-only API route.
- Route workspace API/WebSocket calls through the currently selected connection target.
