# Mexus Terminal Runtime Package Design

## 1. Positioning

`mexus-terminal` is a standalone Web terminal runtime for rendering CLI and TUI programs in browser applications.

It is not a Mexus business module. The package should be usable by any web app that needs to render a long-running CLI process through xterm.js, especially AI Agent CLIs that use TUI-style screen updates, cursor movement, partial redraws, and high-frequency output.

The package has two layers:

- **Core runtime**: generic Web TUI terminal runtime with no Mexus concepts.
- **Mexus adapter**: optional adapter that maps Mexus pane, workspace, WebSocket, and replay events to the generic runtime API.

This structure keeps the core package independently reusable while keeping Mexus integration thin and low-risk.

## 2. Goals

- Provide a low-latency xterm.js rendering runtime for CLI Agent TUI workloads.
- Keep live output responsive even when replay, snapshot restore, or hidden terminals are active.
- Prevent hidden or inactive terminals from consuming unnecessary rendering work.
- Support first-screen restore through IndexedDB snapshots.
- Support prioritized replay scheduling without flooding the main thread.
- Provide a clean React integration layer.
- Keep Mexus business concepts out of the core runtime.
- Allow future standalone publication as a reusable npm package.

## 3. Non-Goals

- The core runtime does not manage processes, PTYs, WebSockets, or server connections.
- The core runtime does not know about panes, agents, workspaces, missions, hubs, or servers.
- The core runtime does not require a specific backend protocol.
- The first version does not implement full persistent terminal history.
- The first version does not implement server-driven terminal resize/repaint.
- The first version does not expose stale restore state in UI.
- The first version does not manually parse ANSI or TUI control sequences.

## 4. Package Layout

```text
packages/mexus-terminal/
├── package.json
├── tsconfig.json
├── src/
│   ├── core/
│   │   ├── runtime.ts
│   │   ├── terminal-session.ts
│   │   ├── scheduler.ts
│   │   ├── replay.ts
│   │   ├── snapshot-store.ts
│   │   ├── snapshot-policy.ts
│   │   ├── write-buffer.ts
│   │   └── types.ts
│   ├── react/
│   │   ├── TuiTerminal.tsx
│   │   ├── useTuiTerminal.ts
│   │   └── types.ts
│   ├── adapters/
│   │   └── mexus/
│   │       ├── adapter.ts
│   │       ├── MexusPaneTerminal.tsx
│   │       ├── event-mapper.ts
│   │       ├── cache-key.ts
│   │       └── types.ts
│   └── index.ts
└── tests/
```

## 5. Core Concepts

### 5.1 Terminal ID

The core layer identifies terminal instances by a generic `terminalId`.

It must not use names like `paneId`, `agentId`, or `workspaceId`.

```ts
type TerminalId = string
```

### 5.2 Visibility

Visibility describes whether a terminal should spend rendering work.

```ts
type TerminalVisibility = 'visible' | 'hidden' | 'detached'
```

- `visible`: live output is rendered to xterm.
- `hidden`: live output is accepted and buffered, but xterm rendering is paused.
- `detached`: no xterm instance is attached; output can still be buffered according to policy.

Mexus active/inactive pane state is translated into this generic visibility state by the adapter.

### 5.3 Live Output

Live output is the highest-priority data path.

Rules:

- Live output must never wait behind replay output.
- Live output may interrupt or cancel replay.
- Live output should be batched per animation frame to reduce render overhead.
- Visible terminals receive live output immediately.
- Hidden terminals store a bounded backlog and render it when visible again.

### 5.4 Replay

Replay is historical output used for restore or history viewing.

Replay is lower priority than live output and is always scheduled.

The core does not define where replay data comes from. It accepts replay sources as async iterables or pushed chunks.

```ts
type ReplayKind = 'head' | 'tail' | 'history'
type ReplayPriority = 'critical' | 'high' | 'normal' | 'background'
```

Recommended mapping:

- `critical`: current visible terminal first-screen replay.
- `high`: current visible terminal remaining replay or soon-needed head replay.
- `normal`: non-visible terminal first-screen prefetch.
- `background`: non-visible remaining replay or optional history fill.

### 5.5 Snapshot

Snapshot is a first-screen restore cache.

The snapshot is not a source of truth. It is a local acceleration layer.

Rules:

- Only cache first-screen snapshots.
- Store snapshots in IndexedDB.
- Do not use localStorage because it is synchronous and too small for terminal data.
- Snapshot restore is silent; UI should not show "stale restore".
- If no cache exists, the terminal still works by requesting or receiving remote head replay.
- Snapshot writes are queued and frequency-limited.

### 5.6 Viewport

Terminal rendering is sensitive to viewport dimensions.

```ts
interface TerminalViewport {
  cols: number
  rows: number
}
```

For TUI workloads, `cols` is more important than `rows` because line wrapping and layout depend primarily on width.

Snapshot restore policy:

- Same `cols`: restore snapshot.
- Small `cols` difference, for example <= 10-15%: allow snapshot restore, then silently correct with remote head replay.
- Large `cols` difference: skip snapshot restore and wait for remote head replay.
- `rows` difference alone is less severe; restore is acceptable when `cols` matches.

## 6. Core API

### 6.1 Runtime Creation

```ts
interface TuiTerminalRuntimeOptions {
  scheduler?: Partial<TerminalSchedulerOptions>
  snapshot?: Partial<TerminalSnapshotOptions>
  writeBuffer?: Partial<TerminalWriteBufferOptions>
}

function createTuiTerminalRuntime(options?: TuiTerminalRuntimeOptions): TuiTerminalRuntime
```

### 6.2 Runtime Interface

```ts
interface TuiTerminalRuntime {
  createTerminal(options: CreateTerminalOptions): TuiTerminalSession
  getTerminal(id: TerminalId): TuiTerminalSession | undefined
  disposeTerminal(id: TerminalId): void
  dispose(): void
}
```

### 6.3 Terminal Session

```ts
interface CreateTerminalOptions {
  id: TerminalId
  xterm: Terminal
  fitAddon?: FitAddon
  cacheKey?: string
}

interface TuiTerminalSession {
  id: TerminalId
  attach(xterm: Terminal, fitAddon?: FitAddon): void
  detach(): void
  dispose(): void

  setVisibility(visibility: TerminalVisibility): void
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

### 6.4 Replay Task

```ts
interface ReplayTask {
  id: string
  kind: ReplayKind
  priority: ReplayPriority
  source: AsyncIterable<string> | Iterable<string>
  interruptible?: boolean
  resetBeforeWrite?: boolean
}

interface ReplayTaskHandle {
  id: string
  cancel(): void
  pause(): void
  resume(): void
}
```

## 7. Scheduler Design

The scheduler controls replay and snapshot writes. Live output does not wait behind replay.

### 7.0 Upstream Transport Backpressure

The runtime must distinguish between local xterm scheduling and upstream transport scheduling.

The core runtime can guarantee that local replay, snapshot restore, and hidden-terminal buffering do not block live writes once data has reached the browser. It cannot guarantee responsiveness if a shared upstream channel is saturated by non-terminal payloads before terminal events arrive.

Rules:

- Core APIs treat `writeLive()` as the highest-priority local path.
- The core does not own WebSocket, HTTP, or backend queueing.
- Adapters must not assume that "input is broken" only because TUI echo is delayed; the input may have reached the backend while live output is queued behind other traffic.
- Mexus integration must keep terminal live traffic ahead of replay, snapshots, file metadata, review data, activity feeds, and other low-priority or large payloads.
- Large non-terminal payloads should be bounded, summarized, split, delayed, or moved to request/response APIs by the adapter or application layer.

This is a package design constraint, not a Git or diff feature requirement. The terminal package should expose enough priority hooks for consumers to protect TUI interactivity, but domain-specific payload shaping belongs outside the core runtime.

### 7.1 Replay Priorities

The scheduler orders replay work by priority:

```text
critical > high > normal > background
```

Within the same priority:

- Prefer visible terminals over hidden terminals.
- Prefer head replay over tail replay.
- Use round-robin slices to avoid one terminal monopolizing the queue.

### 7.2 Slice Budget

Replay writing should be sliced.

Suggested defaults:

```ts
const DEFAULT_REPLAY_SLICE_BYTES = 16 * 1024
const DEFAULT_REPLAY_FRAME_BUDGET_MS = 4
const DEFAULT_MAX_CONCURRENT_REPLAY_WRITERS = 1
```

Each slice writes a bounded amount, then yields to the browser. The runtime can use:

- `requestAnimationFrame` for render-friendly scheduling.
- `requestIdleCallback` for background tasks when available.
- `setTimeout` fallback for browsers without idle callback.

### 7.3 Live Output Interrupt

When live output arrives for a terminal with active replay:

- `critical` head replay may be paused or cancelled depending on policy.
- `tail`, `history`, and `background` replay should be cancelled or demoted.
- Pending replay chunks must not pollute the live xterm state.
- Replay cancellation must fully clear scheduled write state. A stale "scheduled" flag without queued work can prevent later live output from being flushed.
- Replay reset must not leave the terminal in a hidden/paused state unless the current visibility policy explicitly says so.
- Replay start should only reset xterm when the adapter has confirmed this is a restore/replay lifecycle event, not normal live output.

Default policy:

```text
live output interrupts all replay for the same terminal except explicitly protected critical head restore
```

## 8. Snapshot Store

### 8.1 Storage

Use IndexedDB.

Database:

```text
db: mexus-terminal
store: terminal-snapshots
```

Record:

```ts
interface TerminalSnapshotRecord {
  cacheKey: string
  terminalId: string
  sessionKey?: string
  cols: number
  rows: number
  data: string
  createdAt: number
  updatedAt: number
  bytes: number
  schemaVersion: 1
}
```

The core runtime should not define how `cacheKey` is built. Consumers provide it.

### 8.2 Snapshot Format

Preferred format is xterm serialize output through `@xterm/addon-serialize`.

Reason:

- It captures rendered terminal state better than raw byte replay.
- It avoids manual ANSI parsing.
- It is more robust for TUI workloads.

The package should include `@xterm/addon-serialize` as a dependency or peer dependency.

### 8.3 Write Policy

Snapshot writes are best-effort.

Defaults:

```ts
const DEFAULT_SNAPSHOT_MAX_BYTES = 128 * 1024
const DEFAULT_SNAPSHOT_WRITE_DEBOUNCE_MS = 2500
const DEFAULT_SNAPSHOT_MIN_INTERVAL_MS = 5000
const DEFAULT_MAX_SNAPSHOT_WRITE_QUEUE = 32
```

Rules:

- Only write snapshots for visible terminals.
- Debounce writes per terminal.
- Use a global write queue.
- If the queue is full, drop older pending writes for the same terminal.
- Do not block live output on IndexedDB.
- Snapshot write failure should never affect terminal rendering.

### 8.4 Read Policy

Restore flow:

```text
create/attach terminal
→ read snapshot by cacheKey
→ validate cols/rows policy
→ write snapshot to xterm if accepted
→ remote head replay later corrects or replaces it
```

No UI stale label is shown by the package.

## 9. Core React Layer

The React layer should be optional and generic.

```tsx
interface TuiTerminalProps {
  terminalId: string
  runtime: TuiTerminalRuntime
  visible: boolean
  cacheKey?: string
  onInput?: (data: string) => void
  onResize?: (viewport: TerminalViewport) => void
  className?: string
  style?: React.CSSProperties
}
```

The component:

- Creates xterm and fit addon.
- Attaches them to the runtime session.
- Forwards input.
- Emits resize events.
- Sets runtime visibility from `visible`.
- Does not know about Mexus panes or agents.

## 10. Mexus Adapter Layer

The Mexus adapter is optional and can depend on Mexus event shapes.

It maps Mexus concepts to core concepts.

### 10.1 Responsibilities

- Convert `paneId` to `terminalId`.
- Convert active/expanded pane state to `visible` / `hidden`.
- Convert WebSocket `terminal.output` to `writeLive`.
- Convert `terminal.replay.*` to replay tasks.
- Generate cache keys.
- Decide replay priorities from Mexus UI state.
- Clear terminal state on pane close or workspace switch.
- Keep Mexus UI components thin.
- Protect terminal live traffic from lower-priority Mexus events on shared transports.
- Provide diagnostics that can distinguish input delivery failure from output/rendering backpressure.

### 10.2 Adapter API

```ts
interface MexusTerminalAdapterOptions {
  runtime: TuiTerminalRuntime
  getActiveTerminalId: () => string | null
  getWorkspaceCachePrefix: () => string
  getSessionKey?: (terminalId: string) => string | undefined
}

interface MexusTerminalAdapter {
  attachPaneTerminal(options: AttachMexusPaneTerminalOptions): void
  detachPaneTerminal(paneId: string): void
  disposePane(paneId: string): void
  setPaneVisible(paneId: string, visible: boolean): void
  handleServerEvent(event: MexusTerminalServerEvent): void
  resetWorkspace(): void
}
```

### 10.3 Mexus Replay Priority Mapping

Mexus integration can use this policy:

```text
P0: active pane head replay
P1: active pane tail replay
P1: inactive pane head prefetch
P2: inactive pane tail replay
```

Implementation detail:

- The core only sees `critical`, `high`, `normal`, and `background`.
- Mexus adapter performs the mapping.

Suggested mapping:

```ts
active head      -> critical
active tail      -> high
inactive head    -> normal
inactive tail    -> background
```

### 10.4 Mexus Cache Key

The adapter should build keys like:

```text
mexus:v1:{workspaceKey}:{paneId}:{sessionKey}:{cols}
```

`cols` should be included because TUI layout is width-sensitive. `rows` can be stored in the record and used for validation, but width is the stronger cache boundary.

## 11. Integration Plan for Mexus

### Stage 1: Create Package

- Add `packages/mexus-terminal`.
- Implement core runtime, scheduler, write buffer, and snapshot store.
- Add unit tests independent of Mexus web.

### Stage 2: Add Mexus Adapter

- Implement adapter event mapping.
- Add adapter tests using minimal Mexus-like event fixtures.
- Do not modify existing UI yet.

### Stage 3: Replace Existing Registry

- Replace `packages/web/src/stores/terminalRegistry.ts` with adapter calls.
- Keep the old file as a thin compatibility wrapper during migration.
- Replace `Terminal.tsx` internals with generic `TuiTerminal` or `MexusPaneTerminal`.

### Stage 4: Adjust Replay Protocol Usage

- Stop loading replay for every pane on initial connection.
- Request active head replay first.
- Queue active tail and inactive head.
- Keep inactive tail background-only.

### Stage 5: Enable IndexedDB Snapshot

- Enable first-screen snapshot restore.
- Add write queue and frequency control.
- Validate viewport before restore.
- Keep remote head replay as fallback and correction.

## 12. Testing Strategy

### 12.1 Core Unit Tests

Cover:

- Live output writes immediately for visible terminals.
- Hidden terminals buffer output without writing to xterm.
- Hidden terminal backlog flushes once on visibility change.
- Live output interrupts replay for the same terminal.
- Replay priority ordering.
- Replay slice scheduling.
- Snapshot writes are debounced.
- Snapshot read rejects incompatible viewport.
- Dispose clears pending writes and scheduled tasks.

### 12.2 Adapter Tests

Cover:

- Mexus `terminal.output` maps to `writeLive`.
- Mexus replay events create replay tasks.
- Active pane maps to critical head replay.
- Inactive pane maps to normal/background replay.
- Pane close disposes terminal.
- Workspace reset clears adapter state.
- Live output during replay cancels or demotes replay without leaving stale scheduled writes.
- Replay reset clears paused/backlog state unless the terminal is still intentionally hidden.
- Simulated low-priority large events do not execute before terminal live events in the adapter queue.
- Diagnostics identify whether a test input reached the adapter, reached the backend, and produced live output.

### 12.3 Browser Verification

Manual scenarios:

- Refresh page with one active TUI pane.
- Refresh page with multiple busy TUI panes.
- Switch between panes while agents are producing output.
- Resize pane width and refresh.
- Disable IndexedDB or simulate quota failure.
- Use slow WebSocket replay and verify live input remains responsive.

## 13. Failure Handling

- IndexedDB unavailable: disable snapshot store and continue with remote replay.
- Snapshot corrupt: delete record and fall back to remote replay.
- Snapshot viewport incompatible: skip snapshot.
- Replay source fails: mark replay task failed and keep live output path working.
- xterm disposed during task: cancel task.
- Queue overload: drop lower-priority background replay first.
- Upstream transport is congested: keep local terminal queues healthy, surface diagnostics to the adapter, and avoid starting additional background replay.
- Shared channel receives large non-terminal payloads: adapter should defer or drop low-priority work before it can delay terminal live traffic.

## 14. Performance Defaults

Suggested first version defaults:

```ts
const DEFAULT_LIVE_BATCH_MODE = 'animation-frame'
const DEFAULT_REPLAY_SLICE_BYTES = 16 * 1024
const DEFAULT_REPLAY_FRAME_BUDGET_MS = 4
const DEFAULT_MAX_CONCURRENT_REPLAY_WRITERS = 1
const DEFAULT_HIDDEN_BACKLOG_BYTES = 512 * 1024
const DEFAULT_SNAPSHOT_MAX_BYTES = 128 * 1024
const DEFAULT_SNAPSHOT_WRITE_DEBOUNCE_MS = 2500
const DEFAULT_SNAPSHOT_MIN_INTERVAL_MS = 5000
```

These values should be configurable.

## 15. Open Questions

1. Should `@xterm/addon-serialize` be a dependency or peer dependency?
   - Recommendation: dependency for the first internal package version, peer dependency if published externally.

2. Should snapshot restore happen automatically on `attach`, or be explicit?
   - Recommendation: explicit in core, automatic in Mexus adapter.

3. Should core include a React component?
   - Recommendation: yes, but keep it optional and generic.

4. Should tail replay write into hidden xterms?
   - Recommendation: no. Hidden terminals should prefetch data only when useful, but rendering should wait until visible.

## 16. Design Summary

`mexus-terminal` should become the dedicated terminal rendering package for browser-based CLI Agent TUI workloads.

The core layer is reusable and Mexus-free. It handles xterm attachment, live output, replay scheduling, hidden-terminal buffering, snapshot restore, and IndexedDB cache.

The Mexus adapter maps pane/workspace/WebSocket concepts into generic runtime operations, keeping Mexus web integration small and reducing future replacement risk.

The package should prioritize responsiveness over exhaustive replay. Live output is always the highest-priority path. Snapshot and replay are recovery aids, not sources of truth.
