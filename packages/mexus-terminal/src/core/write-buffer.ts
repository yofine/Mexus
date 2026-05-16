export type TerminalWriter = (data: string) => void
export type FrameHandle = number | ReturnType<typeof globalThis.setTimeout>
export type FrameScheduler = (callback: FrameRequestCallback) => FrameHandle
export type FrameCanceller = (handle: FrameHandle) => void

export interface TerminalWriteBufferOptions {
  maxBacklogBytes?: number
  scheduleFrame?: FrameScheduler
  cancelFrame?: FrameCanceller
}

const DEFAULT_MAX_BACKLOG_BYTES = 512 * 1024

const defaultScheduleFrame: FrameScheduler = (callback) => {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(callback)
  }

  return globalThis.setTimeout(() => callback(Date.now()), 16)
}

const defaultCancelFrame: FrameCanceller = (handle) => {
  if (typeof handle === 'number' && typeof globalThis.cancelAnimationFrame === 'function') {
    globalThis.cancelAnimationFrame(handle)
    return
  }

  globalThis.clearTimeout(handle)
}

export class TerminalWriteBuffer {
  private writer: TerminalWriter | null = null
  private visible = true
  private disposed = false
  private pending = ''
  private backlog = ''
  private scheduled = false
  private scheduledHandle: FrameHandle | null = null
  private scheduleToken = 0
  private readonly maxBacklogBytes: number
  private readonly scheduleFrame: FrameScheduler
  private readonly cancelFrame: FrameCanceller

  constructor(options: TerminalWriteBufferOptions = {}) {
    this.maxBacklogBytes = Math.max(0, options.maxBacklogBytes ?? DEFAULT_MAX_BACKLOG_BYTES)
    this.scheduleFrame = options.scheduleFrame ?? defaultScheduleFrame
    this.cancelFrame = options.cancelFrame ?? defaultCancelFrame
  }

  setWriter(writer: TerminalWriter | null): void {
    if (this.disposed) return

    this.writer = writer
    this.scheduleVisibleFlush()
  }

  setVisible(visible: boolean): void {
    if (this.disposed || this.visible === visible) return

    this.visible = visible

    if (!visible) {
      if (this.pending.length > 0) {
        this.pushBacklog(this.pending)
        this.pending = ''
      }
      this.unschedule()
      return
    }

    if (this.backlog.length > 0) {
      this.pending += this.backlog
      this.backlog = ''
    }
    this.scheduleVisibleFlush()
  }

  writeLive(data: string): void {
    if (this.disposed || data.length === 0) return

    if (!this.visible) {
      this.pushBacklog(data)
      return
    }

    this.pending += data
    this.scheduleVisibleFlush()
  }

  clear(): void {
    this.pending = ''
    this.backlog = ''
    this.unschedule()
  }

  dispose(): void {
    if (this.disposed) return

    this.clear()
    this.writer = null
    this.disposed = true
  }

  private scheduleVisibleFlush(): void {
    if (this.disposed || !this.visible || this.scheduled || this.pending.length === 0) {
      return
    }

    this.scheduled = true
    const token = ++this.scheduleToken
    this.scheduledHandle = this.scheduleFrame(() => {
      if (token !== this.scheduleToken) return

      this.scheduled = false
      this.scheduledHandle = null
      this.flushPending()
    })
  }

  private flushPending(): void {
    if (this.disposed || !this.visible || this.pending.length === 0) return

    const data = this.pending
    this.pending = ''

    if (!this.writer) {
      this.pending = data + this.pending
      return
    }

    this.writer(data)
  }

  private pushBacklog(data: string): void {
    if (this.maxBacklogBytes === 0) {
      this.backlog = ''
      return
    }

    this.backlog += data
    if (this.backlog.length > this.maxBacklogBytes) {
      this.backlog = this.backlog.slice(this.backlog.length - this.maxBacklogBytes)
    }
  }

  private unschedule(): void {
    this.scheduleToken++
    this.scheduled = false

    if (this.scheduledHandle !== null) {
      this.cancelFrame(this.scheduledHandle)
      this.scheduledHandle = null
    }
  }
}
