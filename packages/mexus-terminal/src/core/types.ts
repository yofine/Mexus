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
