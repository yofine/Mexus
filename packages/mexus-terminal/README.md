# @mexus/terminal

`@mexus/terminal` is a Web TUI terminal runtime incubated inside Mexus. It is designed for real CLI Agent sessions such as Claude Code, Codex, and OpenCode, where the browser must render node-pty output through xterm.js while preserving interactivity, scrollback, replay order, pane switching, and launch timing.

The package is currently a private workspace package, but its internal shape is intentionally split so the reusable runtime can be extracted later:

- `core`: a generic Web TUI terminal runtime with no Mexus business concepts.
- `react`: stage-level React primitives for mounting multiple terminal sessions in a stable layered surface.
- `adapters/mexus`: Mexus-specific integration for panes, workspace events, replay priority, and Agent launch coordination.
- `demo`: a standalone real node-pty demo for validating TUI rendering behavior.

## Goals

### Problems This Package Solves

CLI Agent TUIs are not plain log streams. They commonly include:

- ANSI control sequences, cursor movement, and full-screen redraws.
- Mixed alt-screen and no-alt-screen behavior.
- Burst output with many small chunks.
- Multiple panes restoring history at the same time.
- User scrollback that must not be pulled back to the bottom by background output.
- Pane collapse, expand, and remount behavior that must not corrupt TUI state.

`@mexus/terminal` centralizes the terminal rendering policy so business components do not need to hand-roll xterm write queues, replay scheduling, hidden-pane buffering, or viewport recovery logic.

### Non-Goals

The core layer does not:

- Create PTY processes.
- Own WebSocket transport.
- Define Mexus pane lifecycle.
- Decide which pane is active or focused.
- Parse Agent status lines.
- Read or write Mexus `.nexus` configuration.

Those responsibilities belong to Mexus Web, Mexus Server, or the `adapters/mexus` layer.

## Package Layout

```text
packages/mexus-terminal/
+-- src/
|   +-- core/
|   |   +-- runtime.ts             # Runtime factory and session registry
|   |   +-- stage.ts               # Multi-session stage controller
|   |   +-- terminal-session.ts    # Single terminal session
|   |   +-- scheduler.ts           # Replay queue, priority, and chunked writes
|   |   +-- write-buffer.ts        # Visibility buffering and frame batching
|   |   +-- snapshot-store.ts      # IndexedDB first-screen snapshot storage
|   |   +-- snapshot-policy.ts     # Snapshot viewport compatibility
|   |   +-- types.ts               # Core public types
|   +-- adapters/
|   |   +-- mexus/
|   |       +-- MexusPaneTerminal.tsx # Mexus React terminal component
|   |       +-- adapter.ts            # Mexus server events -> runtime sessions
|   |       +-- launch-adapter.ts     # Agent launch command coordination
|   |       +-- event-mapper.ts       # Mexus replay priority mapping
|   |       +-- cache-key.ts          # Snapshot cache keys
|   |       +-- types.ts              # Mexus adapter types
|   +-- react/
|   |   +-- TuiTerminalStage.tsx      # Layered multi-session terminal stage
|   |   +-- stage-layout.ts           # Stage layer style helpers
|   +-- index.ts
+-- demo/
|   +-- server.ts       # Vite + WebSocket + node-pty demo server
|   +-- mock-tui.mjs    # Local mock full-screen TUI
|   +-- src/main.tsx    # Demo UI
+-- package.json
```

## Core Runtime

### Runtime

Create a runtime with:

```ts
import { createTuiTerminalRuntime } from '@mexus/terminal'

const runtime = createTuiTerminalRuntime()
const session = runtime.createTerminal({ id: 'pane-a' })
```

The runtime owns multiple terminal sessions:

```ts
interface TuiTerminalRuntime {
  createTerminal(options: CreateTerminalOptions): TuiTerminalSession
  getTerminal(id: TerminalId): TuiTerminalSession | undefined
  disposeTerminal(id: TerminalId): void
  dispose(): void
}
```

Calling `createTerminal()` with an existing id disposes the previous session first. This keeps the session registry single-owner and prevents duplicate writers for one terminal id.

### Session

`TuiTerminalSession` is the core object used by integrations. It wraps:

- xterm attach and detach.
- Visibility state.
- Live output writes.
- Replay task scheduling.
- Snapshot restore.
- fit, refresh, and viewport reporting.

Public contract:

```ts
interface TuiTerminalSession {
  id: TerminalId
  attach(xterm: Terminal, fitAddon?: FitAddon): void
  detach(): void
  dispose(): void

  setVisibility(visibility: 'visible' | 'hidden' | 'detached'): void
  getVisibility(): TerminalVisibility

  writeLive(data: string): void
  enqueueReplay(task: ReplayTask): ReplayTaskHandle
  cancelReplay(taskId: string): void
  cancelAllReplay(): void

  restoreSnapshot(options: RestoreSnapshotOptions): Promise<SnapshotRestoreResult>
  scheduleSnapshotWrite(options?: ScheduleSnapshotOptions): void

  fit(): void
  refresh(): void
  getViewport(): TerminalViewport | null
}
```

### Write Buffer

`TerminalWriteBuffer` controls how data reaches xterm.

Current behavior:

- Visible terminals buffer live output into `pending` and flush on an animation frame.
- Hidden or detached terminals buffer output into `backlog`.
- When a terminal becomes visible again, backlog is merged back into pending output.
- Hidden backlog is capped, currently `512KB` by default, to avoid unbounded memory growth for invisible panes.

This layer reduces pressure from high-frequency small chunks and avoids rendering into zero-size or hidden terminals.

### Follow Output

After writes, the session only follows output when the user was already at the bottom:

```ts
activeBuffer.viewportY >= activeBuffer.baseY
```

If the user has scrolled up, background output will not pull the viewport back to the bottom.

### Replay Scheduler

`TerminalReplayScheduler` handles history replay work.

Capabilities:

- Global replay concurrency limit, default `1`.
- Replay priorities: `critical`, `high`, `normal`, `background`.
- FIFO ordering within the same priority.
- Byte-based chunking, default `64KB`.
- Pause, resume, and cancel handles.
- Optional interruption by live output for `interruptible` replay tasks.

Replay task shape:

```ts
interface ReplayTask {
  id: string
  kind: 'head' | 'tail' | 'history'
  priority: 'critical' | 'high' | 'normal' | 'background'
  source: AsyncIterable<string> | Iterable<string>
  interruptible?: boolean
  resetBeforeWrite?: boolean
}
```

Recommended semantics:

- `head`: first-screen or near-first-screen content that should render quickly.
- `tail`: recent tail output.
- `history`: heavier full-history recovery.
- `critical`: visible pane first-screen replay.
- `background`: non-visible pane full-history replay.

### Snapshots

`TerminalSnapshotStore` stores first-screen snapshots in IndexedDB.

Supported operations:

- `read(cacheKey)`
- `write(record)`
- `delete(cacheKey)`
- Graceful no-op behavior when IndexedDB is unavailable.

`restoreSnapshot()` validates viewport compatibility before writing the snapshot into xterm:

- Same column count: compatible.
- Column delta within the default `15%` ratio: compatible.
- Larger delta: rejected with `incompatible-viewport`.

Current limitation: `scheduleSnapshotWrite()` is a placeholder. Snapshot capture still needs serialization wiring through `@xterm/addon-serialize`.

## Mexus Adapter Layer

`adapters/mexus` maps Mexus business events into the generic runtime.

### MexusTerminalAdapter

Example:

```ts
import {
  createTuiTerminalRuntime,
  createMexusTerminalAdapter,
} from '@mexus/terminal'

const runtime = createTuiTerminalRuntime()
const adapter = createMexusTerminalAdapter({
  runtime,
  workspaceKey: 'workspace-a',
  activePaneId: 'pane-a',
})

adapter.handleEvent({
  type: 'terminal.output',
  paneId: 'pane-a',
  data: 'hello',
})
```

Supported Mexus server events:

```ts
type MexusTerminalServerEvent =
  | { type: 'terminal.output'; paneId: string; data: string }
  | { type: 'terminal.replay.start'; paneId: string; replayId?: string; kind?: ReplayKind }
  | { type: 'terminal.replay.chunk'; paneId: string; replayId?: string; data: string }
  | { type: 'terminal.replay.end'; paneId: string; replayId?: string }
```

Mapping:

- `terminal.output` -> `session.writeLive(data)`
- `terminal.replay.start` -> create a pending replay buffer
- `terminal.replay.chunk` -> append replay data
- `terminal.replay.end` -> create a `ReplayTask` and enqueue it on the session

The adapter maps replay priority based on `activePaneId` and replay kind. The active pane first-screen replay receives the highest priority; non-active full history can be scheduled as background work.

### Cache Keys

Mexus snapshot cache keys use:

```text
mexus:v1:{workspaceKey}:{paneId}:{sessionKey}:{cols}
```

Including `cols` reduces the chance of restoring ANSI-wrapped output into an incompatible terminal width.

### MexusPaneTerminal

React usage:

```tsx
import { MexusPaneTerminal } from '@mexus/terminal'

<MexusPaneTerminal
  paneId="pane-a"
  runtime={runtime}
  visible={isVisible}
  options={{
    cursorBlink: true,
    fontFamily: 'JetBrains Mono, SFMono-Regular, Menlo, monospace',
    fontSize: 13,
  }}
  onInput={(data) => {
    socket.send(JSON.stringify({ type: 'terminal.input', paneId: 'pane-a', data }))
  }}
  onResize={(viewport) => {
    socket.send(JSON.stringify({ type: 'terminal.resize', paneId: 'pane-a', ...viewport }))
  }}
/>
```

Responsibilities:

- Create xterm and FitAddon.
- Open xterm into the DOM container.
- Attach xterm to a runtime session.
- Forward `onData` as input.
- Observe container resize, fit/refresh xterm, and notify the integration layer.
- Stop wheel propagation to avoid conflicts with outer pane scrolling.

## Multi-Session Stage

The Stage model is used when multiple Agent panes exist at the same time.

The product model is:

```text
Pane list = a stack of records
Terminal stage = the player
Active pane = the record currently on the player
Inactive pane = still mounted and rendering, but not visible or interactive
```

This replaces the older hidden parking approach where collapsed panes moved their xterm surface into a hidden offscreen area. That approach is fragile for Agent TUIs because Codex and Claude Code frequently repaint the screen with cursor movement, clear-screen sequences, and prompt/status redraws. If the xterm surface is zero-sized, detached, or refit while hidden, restored scrollback can miss lines or show stale prompt blocks.

Stage rules:

- Every session keeps a stable terminal surface while the stage is mounted.
- Switching sessions changes layer order and pointer/input ownership.
- Inactive layers remain `visibility: visible` and full-size, but have `opacity: 0` and `pointer-events: none`.
- Input is only forwarded for the active session.
- Resize notifications are only sent for the active session.
- Session switching must not recreate xterm, replay history, or resize hidden terminals.

Core stage controller:

```ts
import { TerminalStageController, createTuiTerminalRuntime } from '@mexus/terminal'

const runtime = createTuiTerminalRuntime()
const stage = new TerminalStageController(runtime)

stage.setSessions(['pane-a', 'pane-b'])
stage.setActiveSession('pane-a')
stage.writeLive('pane-b', 'background output')
```

React stage:

```tsx
import { TuiTerminalStage } from '@mexus/terminal'

<TuiTerminalStage
  sessionIds={['pane-a', 'pane-b']}
  activeSessionId="pane-a"
  runtime={runtime}
  onInput={(sessionId, data) => {
    send({ type: 'terminal.input', paneId: sessionId, data })
  }}
  onResize={(sessionId, viewport) => {
    send({ type: 'terminal.resize', paneId: sessionId, ...viewport })
  }}
/>
```

Mexus Web currently uses the stage layout with its existing terminal registry compatibility layer so WebSocket output can continue to bypass React.

### Launch Adapter

`MexusTerminalLaunchAdapter` coordinates Agent command launch after terminal readiness.

```ts
const launchAdapter = new MexusTerminalLaunchAdapter({
  writeInput: (paneId, data) => {
    send({ type: 'terminal.input', paneId, data })
  },
})

launchAdapter.markTerminalReady('pane-a')

await launchAdapter.launchResolvedTerminalAgent({
  paneId: 'pane-a',
  command: 'codex --no-alt-screen',
})
```

Default behavior:

- Wait for `markTerminalReady(paneId)`.
- Append `\r` by default to execute the command.
- With `autoExecute: false`, write the command without appending Enter.
- Reject pending launches if terminal readiness is rejected.

## Demo

The demo is a standalone real PTY environment for validating xterm rendering, Agent TUI output, input behavior, scrolling, and color support.

Start it with:

```bash
MEXUS_TERMINAL_DEMO_PORT=5178 pnpm --filter @mexus/terminal demo
```

Default URL:

```text
http://localhost:5178
```

The demo server listens on `0.0.0.0` by default for remote access. You can also set it explicitly:

```bash
MEXUS_TERMINAL_DEMO_HOST=0.0.0.0 MEXUS_TERMINAL_DEMO_PORT=5178 pnpm --filter @mexus/terminal demo
```

The demo includes:

- WebSocket `/pty`
- node-pty shell
- xterm terminal
- `Single session` module for validating the original one-terminal runtime path.
- `Stage stack` module for validating three independent terminal sessions and the layered multi-session stage.
- local mock full-screen TUI
- Claude Code preset
- Codex preset
- Agent output diagnostic prompt buttons

### Presets

| Preset | Command | Purpose |
|---|---|---|
| Mock TUI | `node demo/mock-tui.mjs` | Local full-screen TUI validation without an external Agent |
| Claude Code | `CLAUDE_CODE_NO_FLICKER=1 claude --permission-mode acceptEdits` | Claude Code TUI validation |
| Codex | `codex --no-alt-screen --dangerously-bypass-approvals-and-sandbox` | Codex no-alt-screen output validation |
| Shell | empty command | Plain shell only |

### Diagnostic Buttons

Diagnostic buttons only insert prompts into the active TUI input. They do not press Enter automatically.

Recommended multi-session flow:

1. Click `Connect all`.
2. Select a pane record and start an Agent preset.
3. Start another pane or send `BG burst B/C` to validate background output.
4. Switch between pane records while output is running.
5. Click a diagnostic button.
6. Confirm the inserted prompt in the active Agent TUI.
7. Press Enter manually.

Expected results:

- Only the active pane accepts keyboard input.
- Background panes keep receiving output while invisible.
- Switching panes does not recreate xterm or replay history.
- Long sequential output should not lose numbered lines because of pane switching.
- The active pane should keep its TUI input area anchored after switching.

Agent diagnostic flow:

1. Start an Agent preset.
2. Click a diagnostic button.
3. Confirm the inserted prompt in the Agent TUI.
4. Press Enter manually.

Diagnostic prompts cover:

- Missing sequential numbered lines.
- Fast and slow output.
- Markdown-like plain text.
- Long-line wrapping.
- Chinese, emoji, and wide characters.
- Dense lists.
- fenced code blocks.
- Markdown table source text.
- Blank lines and paragraph boundaries.
- 120-line stress output.

Note: a terminal is a character UI, not an HTML renderer. Markdown tables are expected to appear as plain text.

## Mexus Web Integration

Recommended output path:

```text
WebSocket event
  -> MexusTerminalAdapter.handleEvent()
  -> TuiTerminalSession.writeLive() / enqueueReplay()
  -> TerminalWriteBuffer
  -> xterm.write()
```

Input path:

```text
xterm.onData()
  -> MexusPaneTerminal.onInput()
  -> WebSocket terminal.input
  -> server PtyManager.write()
  -> node-pty
```

Resize path:

```text
ResizeObserver
  -> session.fit()
  -> session.getViewport()
  -> WebSocket terminal.resize
  -> node-pty.resize(cols, rows)
```

### Replay Strategy

Recommended priority model for Mexus:

1. Visible pane first-screen replay: `critical`
2. Visible pane remaining replay and non-visible pane first-screen replay: `high` or `normal`
3. Non-visible pane full replay: `background`

If the server does not yet split head/full replay, it can send `history` first and let the adapter map it conservatively.

### Live Output and Replay Ordering

Core `writeLive()` calls `replayScheduler.interruptForLiveOutput(id)`, which only cancels replay tasks marked as `interruptible`.

Mexus Web currently keeps a compatibility layer in `packages/web/src/stores/terminalRegistry.ts`: while server replay is active, live output is queued and appended after `terminal.replay.end`. This prevents a refresh/reopen from dropping older Agent replies when live output arrives during replay.

Over time, this ordering policy should move into `@mexus/terminal` or the Mexus adapter so `terminalRegistry.ts` can become thinner.

## Agent Launch Notes

### Claude Code

Recommended command:

```bash
CLAUDE_CODE_NO_FLICKER=1 claude --permission-mode acceptEdits
```

Rationale:

- `CLAUDE_CODE_NO_FLICKER=1` reduces flicker and frequent full-screen redraws.
- `--permission-mode acceptEdits` matches the current Mexus Agent pane workflow.

### Codex

For Mexus pane usage, prefer no-alt-screen mode:

```bash
codex --no-alt-screen
```

Rationale:

- no-alt-screen keeps output in normal scrollback.
- Users can still inspect Agent output after leaving the TUI.
- Replay and browser scrollback are more predictable.

Superset has used a richer Codex command shape:

```bash
codex \
  -c model_reasoning_effort="high" \
  -c model_reasoning_summary="detailed" \
  -c model_supports_reasoning_summaries=true \
  --sandbox workspace-write \
  --ask-for-approval never
```

Parameter notes:

- `model_reasoning_effort="high"`: requests higher reasoning effort.
- `model_reasoning_summary="detailed"`: asks for a more detailed reasoning summary.
- `model_supports_reasoning_summaries=true`: tells the CLI that the selected model supports reasoning summaries.
- `--sandbox workspace-write`: allows workspace writes while avoiding broader system access.
- `--ask-for-approval never`: disables approval prompts; useful for automation but higher risk.

These should remain Agent preset or user configuration concerns. They should not be hard-coded into the core runtime.

## Tests

Run package tests:

```bash
pnpm --filter @mexus/terminal test
```

Run type checking:

```bash
pnpm --filter @mexus/terminal typecheck
```

Current coverage includes:

- Runtime session creation, replacement, and disposal.
- Multi-session stage registration, active switching, inactive session output, and disposal.
- Stage layer style guarantees for full-size invisible inactive terminals.
- attach/detach buffering.
- visible/hidden switching.
- live output interrupting replay.
- not forcing scroll-to-bottom while the user is reading history.
- replay priority, queueing, cancel, pause, and resume.
- replay byte slicing.
- write buffer backlog limits.
- snapshot viewport compatibility.
- Mexus adapter event mapping.
- Mexus launch adapter readiness and `autoExecute`.

## Current Limitations

### Snapshot Capture Is Not Fully Wired

`restoreSnapshot()` and `TerminalSnapshotStore` can read and restore snapshots, but `scheduleSnapshotWrite()` is still a placeholder. The next step is to wire `@xterm/addon-serialize` and write first-screen snapshots to IndexedDB during idle time.

### React Layer Is Stage-Oriented

The package includes a small React stage component for Mexus' multi-pane use case. It is intentionally thin: it owns DOM layering, not PTY transport or business state. If core is extracted later, this React layer can either remain Mexus-specific or be replaced by a consumer-owned UI layer.

### PTY and Transport Are External

This package does not own backend PTY creation or WebSocket transport. The demo server is only a validation environment, not the production server runtime.

### Observability Is Still Minimal

Future developer-mode diagnostics should expose:

- Pending write bytes.
- Hidden backlog bytes.
- Replay queue length.
- Active replay task.
- Last write time.
- Snapshot restore result.
- Dropped or cancelled replay count.

These metrics would help diagnose symptoms such as "input appears stuck", "output is missing lines", and "history disappears after refresh".

## Development Rules

1. Keep core free of Mexus concepts such as pane, workspace, agent, and active pane.
2. Put Mexus-specific mapping in `src/adapters/mexus`.
3. Preserve output order and interactivity before optimizing replay speed.
4. Do not blindly replay local terminal history on attach/remount; TUI control sequences may no longer be valid.
5. Do not pull the viewport to the bottom when the user has scrolled up.
6. Replay must be cancellable or deprioritized so multiple panes cannot freeze the first screen.
7. Keep the public API small and stable; extend through options or adapters where possible.
