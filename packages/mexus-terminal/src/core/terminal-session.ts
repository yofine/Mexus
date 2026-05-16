import type { FitAddon } from '@xterm/addon-fit'
import type { Terminal } from '@xterm/xterm'

import {
  TerminalReplayScheduler,
  type ReplayWriter,
} from './scheduler'
import { isSnapshotViewportCompatible } from './snapshot-policy'
import { TerminalSnapshotStore, type TerminalSnapshotRecord } from './snapshot-store'
import type {
  ReplayTask,
  ReplayTaskHandle,
  RestoreSnapshotOptions,
  ScheduleSnapshotOptions,
  SnapshotRestoreResult,
  TerminalId,
  TerminalViewport,
  TerminalVisibility,
  TuiTerminalSession as TuiTerminalSessionContract,
} from './types'
import { TerminalWriteBuffer, type TerminalWriteBufferOptions } from './write-buffer'

type ReplayScheduler = Pick<
  TerminalReplayScheduler,
  'enqueue' | 'cancel' | 'cancelAll' | 'dispose' | 'interruptForLiveOutput'
>

type SnapshotStore = Pick<TerminalSnapshotStore, 'read'>

export interface TuiTerminalSessionOptions {
  replayScheduler?: ReplayScheduler
  ownsReplayScheduler?: boolean
  snapshotStore?: SnapshotStore | null
  writeBufferOptions?: TerminalWriteBufferOptions
}

export class TuiTerminalSession implements TuiTerminalSessionContract {
  readonly id: TerminalId

  private xterm: Terminal | null = null
  private fitAddon: FitAddon | null = null
  private visibility: TerminalVisibility = 'detached'
  private readonly writeBuffer: TerminalWriteBuffer
  private readonly replayScheduler: ReplayScheduler
  private readonly ownsReplayScheduler: boolean
  private readonly snapshotStore: SnapshotStore | null
  private disposed = false

  constructor(id: TerminalId, options: TuiTerminalSessionOptions = {}) {
    this.id = id
    this.writeBuffer = new TerminalWriteBuffer(options.writeBufferOptions)
    this.replayScheduler = options.replayScheduler ?? new TerminalReplayScheduler()
    this.ownsReplayScheduler = options.ownsReplayScheduler ?? !options.replayScheduler
    this.snapshotStore = options.snapshotStore === undefined ? new TerminalSnapshotStore() : options.snapshotStore
  }

  attach(xterm: Terminal, fitAddon?: FitAddon): void {
    if (this.disposed) return

    this.xterm = xterm
    this.fitAddon = fitAddon ?? null
    this.visibility = 'visible'
    this.writeBuffer.setWriter((data) => {
      this.xterm?.write(data)
    })
    this.writeBuffer.setVisible(true)
  }

  detach(): void {
    if (this.disposed) return

    this.xterm = null
    this.fitAddon = null
    this.visibility = 'detached'
    this.writeBuffer.setWriter(null)
  }

  dispose(): void {
    if (this.disposed) return

    this.replayScheduler.cancelAll()
    if (this.ownsReplayScheduler) {
      this.replayScheduler.dispose()
    }
    this.writeBuffer.dispose()
    this.xterm = null
    this.fitAddon = null
    this.visibility = 'detached'
    this.disposed = true
  }

  setVisibility(visibility: TerminalVisibility): void {
    if (this.disposed) return

    this.visibility = visibility
    this.writeBuffer.setVisible(visibility === 'visible')
  }

  getVisibility(): TerminalVisibility {
    return this.visibility
  }

  writeLive(data: string): void {
    if (this.disposed) return

    this.replayScheduler.interruptForLiveOutput(this.id)
    this.writeBuffer.writeLive(data)
  }

  enqueueReplay(task: ReplayTask): ReplayTaskHandle {
    if (this.disposed) {
      throw new Error('TuiTerminalSession is disposed')
    }

    return this.replayScheduler.enqueue(this.id, task, this.createReplayWriter())
  }

  cancelReplay(taskId: string): void {
    if (this.disposed) return

    this.replayScheduler.cancel(taskId)
  }

  cancelAllReplay(): void {
    if (this.disposed) return

    this.replayScheduler.cancelAll()
  }

  async restoreSnapshot(options: RestoreSnapshotOptions): Promise<SnapshotRestoreResult> {
    if (this.disposed) {
      return { restored: false, reason: 'unavailable' }
    }

    if (!this.snapshotStore) {
      return { restored: false, reason: 'unavailable' }
    }

    try {
      const snapshot = await this.snapshotStore.read(options.cacheKey)
      if (!snapshot) {
        return { restored: false, reason: 'missing' }
      }

      if (!this.isSnapshotCompatible(snapshot, options.viewport)) {
        return { restored: false, reason: 'incompatible-viewport' }
      }

      this.xterm?.clear?.()
      this.writeBuffer.clear()
      this.writeBuffer.writeLive(snapshot.data)
      return { restored: true }
    } catch {
      return { restored: false, reason: 'error' }
    }
  }

  scheduleSnapshotWrite(_options: ScheduleSnapshotOptions = {}): void {
    // Snapshot capture depends on serialization wiring that is not part of this runtime slice yet.
  }

  fit(): void {
    try {
      this.fitAddon?.fit()
    } catch {
      // Fit failures should not break terminal IO.
    }
  }

  refresh(): void {
    try {
      const viewport = this.getViewport()
      if (!viewport) return

      this.xterm?.refresh(0, Math.max(0, viewport.rows - 1))
    } catch {
      // Refresh failures are non-fatal; callers can retry on the next frame.
    }
  }

  getViewport(): TerminalViewport | null {
    if (!this.xterm || typeof this.xterm.cols !== 'number' || typeof this.xterm.rows !== 'number') {
      return null
    }

    return { cols: this.xterm.cols, rows: this.xterm.rows }
  }

  private createReplayWriter(): ReplayWriter {
    return {
      write: (data) => {
        this.writeBuffer.writeLive(data)
      },
      reset: () => {
        this.writeBuffer.clear()
        this.xterm?.clear?.()
      },
    }
  }

  private isSnapshotCompatible(
    snapshot: Pick<TerminalSnapshotRecord, 'cols' | 'rows'>,
    viewport: TerminalViewport,
  ): boolean {
    return isSnapshotViewportCompatible(
      { cols: snapshot.cols, rows: snapshot.rows },
      viewport,
    )
  }
}
