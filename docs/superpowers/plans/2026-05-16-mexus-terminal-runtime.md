# Mexus Terminal Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent `@mexus/terminal` package for browser TUI terminal rendering, then integrate it into Mexus without changing product behavior.

**Architecture:** Create a reusable core runtime with no Mexus concepts, an optional React layer, and a Mexus adapter that maps pane/WebSocket/replay events into generic terminal operations. The existing `packages/web/src/stores/terminalRegistry.ts` remains as a compatibility wrapper until the adapter is verified.

**Tech Stack:** TypeScript, React 18, xterm.js, `@xterm/addon-fit`, `@xterm/addon-serialize`, Vitest, pnpm workspace.

---

## File Map

- Create `packages/mexus-terminal/package.json`: package metadata, exports, scripts.
- Create `packages/mexus-terminal/tsconfig.json`: standalone strict TypeScript config.
- Create `packages/mexus-terminal/src/core/types.ts`: public core types.
- Create `packages/mexus-terminal/src/core/write-buffer.ts`: live write batching and hidden backlog.
- Create `packages/mexus-terminal/src/core/scheduler.ts`: replay task scheduler.
- Create `packages/mexus-terminal/src/core/terminal-session.ts`: per-terminal runtime state.
- Create `packages/mexus-terminal/src/core/runtime.ts`: runtime factory and session registry.
- Create `packages/mexus-terminal/src/core/snapshot-store.ts`: IndexedDB snapshot storage.
- Create `packages/mexus-terminal/src/react/TuiTerminal.tsx`: generic React xterm component.
- Create `packages/mexus-terminal/src/adapters/mexus/adapter.ts`: Mexus event adapter.
- Create `packages/mexus-terminal/src/index.ts`: package exports.
- Create tests under `packages/mexus-terminal/src/**/*.test.ts`.
- Later modify `packages/web/package.json`: depend on `@mexus/terminal`.
- Later modify `packages/web/src/stores/terminalRegistry.ts`: compatibility wrapper over Mexus adapter.
- Later modify `packages/web/src/components/Terminal.tsx`: use generic React terminal component.

## Stage 1: Package Scaffold

### Task 1: Create `@mexus/terminal` package skeleton

**Files:**
- Create: `packages/mexus-terminal/package.json`
- Create: `packages/mexus-terminal/tsconfig.json`
- Create: `packages/mexus-terminal/src/index.ts`
- Create: `packages/mexus-terminal/src/core/types.ts`

- [ ] **Step 1: Add package metadata**

Create `packages/mexus-terminal/package.json`:

```json
{
  "name": "@mexus/terminal",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "Apache-2.0",
  "author": "yofine",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    }
  },
  "files": [
    "src"
  ],
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "peerDependencies": {
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/xterm": "^5.5.0",
    "react": "^18.0.0"
  },
  "dependencies": {
    "@xterm/addon-serialize": "^0.13.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "typescript": "^5.6.0",
    "vitest": "^4.1.0"
  }
}
```

- [ ] **Step 2: Add TypeScript config**

Create `packages/mexus-terminal/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Define public core types**

Create `packages/mexus-terminal/src/core/types.ts`:

```ts
import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'

export type TerminalId = string
export type TerminalVisibility = 'visible' | 'hidden' | 'detached'
export type ReplayKind = 'head' | 'tail' | 'history'
export type ReplayPriority = 'critical' | 'high' | 'normal' | 'background'

export interface TerminalViewport {
  cols: number
  rows: number
}

export interface CreateTerminalOptions {
  id: TerminalId
  xterm?: Terminal
  fitAddon?: FitAddon
  cacheKey?: string
}

export interface ReplayTask {
  id: string
  kind: ReplayKind
  priority: ReplayPriority
  source: AsyncIterable<string> | Iterable<string>
  interruptible?: boolean
  resetBeforeWrite?: boolean
}

export interface ReplayTaskHandle {
  id: string
  cancel(): void
  pause(): void
  resume(): void
}

export interface RestoreSnapshotOptions {
  cacheKey: string
  viewport: TerminalViewport
}

export interface SnapshotRestoreResult {
  restored: boolean
  reason?: 'missing' | 'incompatible-viewport' | 'unavailable' | 'error'
}

export interface ScheduleSnapshotOptions {
  cacheKey?: string
}

export interface TuiTerminalSession {
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

export interface TuiTerminalRuntime {
  createTerminal(options: CreateTerminalOptions): TuiTerminalSession
  getTerminal(id: TerminalId): TuiTerminalSession | undefined
  disposeTerminal(id: TerminalId): void
  dispose(): void
}
```

- [ ] **Step 4: Export placeholder API**

Create `packages/mexus-terminal/src/index.ts`:

```ts
export type {
  CreateTerminalOptions,
  ReplayKind,
  ReplayPriority,
  ReplayTask,
  ReplayTaskHandle,
  RestoreSnapshotOptions,
  ScheduleSnapshotOptions,
  SnapshotRestoreResult,
  TerminalId,
  TerminalViewport,
  TerminalVisibility,
  TuiTerminalRuntime,
  TuiTerminalSession,
} from './core/types'
```

- [ ] **Step 5: Verify package typecheck**

Run:

```bash
pnpm --filter @mexus/terminal typecheck
```

Expected: TypeScript exits successfully.

## Stage 2: Core Runtime

### Task 2: Implement write buffer with live priority

**Files:**
- Create: `packages/mexus-terminal/src/core/write-buffer.ts`
- Test: `packages/mexus-terminal/src/core/write-buffer.test.ts`

- [ ] **Step 1: Write failing tests**

Tests must cover:

- visible terminal writes live output on the next frame.
- hidden terminal buffers output and flushes on visibility.
- clearing pending writes resets scheduler state so later live writes still flush.
- backlog is bounded.

- [ ] **Step 2: Implement write buffer**

Implement a small class:

```ts
export class TerminalWriteBuffer {
  constructor(options?: { maxHiddenBacklogBytes?: number; requestFrame?: (cb: () => void) => void })
  setWriter(writer: ((data: string) => void) | null): void
  setVisible(visible: boolean): void
  writeLive(data: string): void
  clear(): void
  dispose(): void
}
```

Required behavior:

- visible writes batch through one frame callback.
- hidden writes append to bounded backlog.
- `setVisible(true)` flushes backlog once.
- `clear()` empties pending/backlog and resets any scheduled flag.

- [ ] **Step 3: Run tests**

Run:

```bash
pnpm --filter @mexus/terminal test src/core/write-buffer.test.ts
```

Expected: all tests pass.

### Task 3: Implement replay scheduler

**Files:**
- Create: `packages/mexus-terminal/src/core/scheduler.ts`
- Test: `packages/mexus-terminal/src/core/scheduler.test.ts`

- [ ] **Step 1: Write failing tests**

Tests must cover:

- `critical > high > normal > background`.
- live interrupt cancels interruptible replay for the same terminal.
- only one replay writer runs at a time by default.
- cancelled replay does not write remaining chunks.

- [ ] **Step 2: Implement scheduler**

Implement:

```ts
export interface TerminalReplaySchedulerOptions {
  sliceBytes?: number
  frameBudgetMs?: number
  maxConcurrentReplayWriters?: number
  schedule?: (cb: () => void) => void
  now?: () => number
}

export class TerminalReplayScheduler {
  enqueue(terminalId: string, task: ReplayTask, write: (data: string) => void, reset?: () => void): ReplayTaskHandle
  cancel(terminalId: string, taskId: string): void
  cancelAll(terminalId: string): void
  interruptForLiveOutput(terminalId: string): void
  dispose(): void
}
```

Rules:

- sort by priority first.
- yield between slices.
- `resetBeforeWrite` calls reset only once before first chunk.
- cancelled tasks must not leave stale scheduled state.

- [ ] **Step 3: Run tests**

Run:

```bash
pnpm --filter @mexus/terminal test src/core/scheduler.test.ts
```

Expected: all tests pass.

### Task 4: Implement terminal session and runtime

**Files:**
- Create: `packages/mexus-terminal/src/core/terminal-session.ts`
- Create: `packages/mexus-terminal/src/core/runtime.ts`
- Test: `packages/mexus-terminal/src/core/terminal-session.test.ts`
- Modify: `packages/mexus-terminal/src/index.ts`

- [ ] **Step 1: Write failing session tests**

Tests must cover:

- `writeLive()` interrupts replay before writing.
- visibility controls write buffer behavior.
- `detach()` keeps session state but removes xterm writer.
- `dispose()` clears replay tasks and buffers.
- `fit()` catches detached/invalid xterm errors.

- [ ] **Step 2: Implement session**

Use `TerminalWriteBuffer` and `TerminalReplayScheduler`.

`writeLive(data)` order:

1. `scheduler.interruptForLiveOutput(id)`
2. `writeBuffer.writeLive(data)`
3. schedule snapshot write if enabled in a later task

- [ ] **Step 3: Implement runtime factory**

Expose:

```ts
export function createTuiTerminalRuntime(): TuiTerminalRuntime
```

Rules:

- creating an existing terminal id disposes the old session.
- `disposeTerminal(id)` disposes one session.
- `dispose()` disposes all sessions and the scheduler.

- [ ] **Step 4: Export runtime API**

Update `packages/mexus-terminal/src/index.ts`:

```ts
export { createTuiTerminalRuntime } from './core/runtime'
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
pnpm --filter @mexus/terminal test src/core/terminal-session.test.ts
pnpm --filter @mexus/terminal typecheck
```

Expected: all tests and typecheck pass.

## Stage 3: Snapshot Store

### Task 5: Add IndexedDB first-screen snapshot store

**Files:**
- Create: `packages/mexus-terminal/src/core/snapshot-store.ts`
- Create: `packages/mexus-terminal/src/core/snapshot-policy.ts`
- Test: `packages/mexus-terminal/src/core/snapshot-policy.test.ts`

- [ ] **Step 1: Write snapshot policy tests**

Tests must cover:

- same `cols` restores.
- small `cols` difference within 15% restores.
- large `cols` difference rejects.
- missing rows does not reject if cols match.

- [ ] **Step 2: Implement pure viewport policy**

Create:

```ts
export function isSnapshotViewportCompatible(
  snapshot: { cols: number; rows: number },
  current: { cols: number; rows: number },
  maxColsDeltaRatio = 0.15,
): boolean
```

- [ ] **Step 3: Implement best-effort IndexedDB store**

Expose:

```ts
export interface TerminalSnapshotRecord {
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

export class TerminalSnapshotStore {
  read(cacheKey: string): Promise<TerminalSnapshotRecord | null>
  write(record: TerminalSnapshotRecord): Promise<void>
  delete(cacheKey: string): Promise<void>
}
```

Rules:

- if IndexedDB is unavailable, reads return `null` and writes no-op.
- no UI state is exposed for stale restore.

- [ ] **Step 4: Wire snapshot methods into session**

Use `@xterm/addon-serialize` only inside session snapshot code. Snapshot writes are best-effort and must not block live writes.

## Stage 4: React Layer

### Task 6: Add generic `TuiTerminal` React component

**Files:**
- Create: `packages/mexus-terminal/src/react/TuiTerminal.tsx`
- Create: `packages/mexus-terminal/src/react/types.ts`
- Modify: `packages/mexus-terminal/src/index.ts`

- [ ] **Step 1: Implement props**

```ts
export interface TuiTerminalProps {
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

- [ ] **Step 2: Implement component behavior**

Rules:

- create xterm and fit addon on mount.
- attach to runtime session.
- forward `term.onData` to `onInput`.
- fit only when container has non-zero size.
- call `session.setVisibility()` when `visible` changes.
- focus xterm on pointer down.
- dispose xterm and detach session on unmount.

- [ ] **Step 3: Export React API**

Update `packages/mexus-terminal/src/index.ts`:

```ts
export { TuiTerminal } from './react/TuiTerminal'
export type { TuiTerminalProps } from './react/types'
```

- [ ] **Step 4: Typecheck**

Run:

```bash
pnpm --filter @mexus/terminal typecheck
```

Expected: success.

## Stage 5: Mexus Adapter

### Task 7: Implement Mexus adapter without touching existing UI

**Files:**
- Create: `packages/mexus-terminal/src/adapters/mexus/types.ts`
- Create: `packages/mexus-terminal/src/adapters/mexus/cache-key.ts`
- Create: `packages/mexus-terminal/src/adapters/mexus/event-mapper.ts`
- Create: `packages/mexus-terminal/src/adapters/mexus/adapter.ts`
- Test: `packages/mexus-terminal/src/adapters/mexus/adapter.test.ts`
- Modify: `packages/mexus-terminal/src/index.ts`

- [ ] **Step 1: Define Mexus adapter event types**

Keep these types local to the adapter and minimal:

```ts
export type MexusTerminalServerEvent =
  | { type: 'terminal.output'; paneId: string; data: string }
  | { type: 'terminal.replay.start'; paneId: string; bytes: number }
  | { type: 'terminal.replay.chunk'; paneId: string; data: string; seq: number }
  | { type: 'terminal.replay.end'; paneId: string; chunks: number }
```

- [ ] **Step 2: Implement cache key helper**

```ts
export function buildMexusTerminalCacheKey(input: {
  workspaceKey: string
  paneId: string
  sessionKey?: string
  cols: number
}): string
```

Expected format:

```text
mexus:v1:{workspaceKey}:{paneId}:{sessionKey-or-none}:{cols}
```

- [ ] **Step 3: Implement adapter**

Adapter responsibilities:

- `terminal.output` calls `session.writeLive(data)`.
- replay start/chunk/end build one replay task per pane.
- active head replay maps to `critical`.
- inactive replay maps to `normal` or `background`.
- `resetWorkspace()` cancels all replay and disposes known sessions.

- [ ] **Step 4: Write adapter tests**

Tests must cover:

- live output maps to `writeLive`.
- live output during replay cancels replay.
- workspace reset clears adapter state.
- cache key includes cols.

## Stage 6: Mexus Web Integration

### Task 8: Add dependency and compatibility wrapper

**Files:**
- Modify: `packages/web/package.json`
- Modify: `packages/web/src/stores/terminalRegistry.ts`
- Test: `packages/web/src/stores/terminalRegistry.test.ts`

- [ ] **Step 1: Add workspace dependency**

Add to `packages/web/package.json` dependencies:

```json
"@mexus/terminal": "workspace:*"
```

- [ ] **Step 2: Keep old exported functions stable**

`terminalRegistry.ts` must continue exporting:

- `registerTerminalWriter`
- `unregisterTerminalWriter`
- `writeToTerminal`
- `writeReplayToTerminal`
- `finishTerminalReplay`
- `resetTerminalForReplay`
- `clearTerminalHistory`
- `clearAllHistories`
- `pauseTerminal`
- `unpauseTerminal`
- `resumeTerminal`
- `scrollTerminalToBottom`
- `refitTerminal`
- `getTerminalDimensions`

Internally, migrate implementation to the new runtime one function at a time. Do not change callers in this task.

- [ ] **Step 3: Preserve existing tests**

Run:

```bash
pnpm --filter @nexus/web exec vitest run src/stores/terminalRegistry.test.ts
```

Expected: existing tests pass.

### Task 9: Replace `Terminal.tsx` internals

**Files:**
- Modify: `packages/web/src/components/Terminal.tsx`

- [ ] **Step 1: Keep public props unchanged**

Do not change:

```ts
interface TerminalProps {
  paneId: string
  onData: (data: string) => void
  onResize: (cols: number, rows: number) => void
}
```

- [ ] **Step 2: Use package React component internally**

Render `TuiTerminal` and map:

- `terminalId = paneId`
- `onInput = onData`
- `onResize = ({ cols, rows }) => onResize(cols, rows)`
- `visible = true`

Visibility remains owned by current Mexus UI until a later integration task.

- [ ] **Step 3: Verify web typecheck**

Run:

```bash
pnpm --filter @nexus/web exec tsc -b
```

Expected: success.

## Stage 7: Verification

### Task 10: End-to-end local verification

**Files:**
- No required file changes.

- [ ] **Step 1: Run package tests**

```bash
pnpm --filter @mexus/terminal test
```

Expected: all package tests pass.

- [ ] **Step 2: Run web terminal registry tests**

```bash
pnpm --filter @nexus/web exec vitest run src/stores/terminalRegistry.test.ts
```

Expected: pass.

- [ ] **Step 3: Run web typecheck**

```bash
pnpm --filter @nexus/web exec tsc -b
```

Expected: pass.

- [ ] **Step 4: Manual smoke test**

Start Mexus and verify:

- bottom terminal accepts input.
- Agent pane accepts input.
- switching panes does not lose terminal output.
- refreshing with existing scrollback does not freeze input.
- creating a shell pane works.

## Execution Notes

- Do not modify Git diff transport in this plan.
- Do not change Agent startup or restore semantics in this plan.
- Do not change Pane UI layout in this plan.
- Keep Mexus concepts out of `src/core` and `src/react`.
- Mexus-specific names are allowed only under `src/adapters/mexus`.
- If a task needs broader architecture changes, stop and report before editing unrelated files.

