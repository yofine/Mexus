import type { ReplayPriority, ReplayTask, ReplayTaskHandle, TerminalId } from './types'

export interface ReplayWriter {
  write(data: string): void | Promise<void>
  reset?(): void | Promise<void>
}

export interface TerminalReplaySchedulerOptions {
  maxConcurrentReplayWriters?: number
  sliceBytes?: number
  schedule?: () => Promise<void>
}

interface QueuedReplay {
  terminalId: TerminalId
  task: ReplayTask
  writer: ReplayWriter
  sequence: number
  cancelled: boolean
  paused: boolean
  resumeWaiters: Array<() => void>
}

const priorityRank: Record<ReplayPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  background: 3,
}

const defaultSliceBytes = 64 * 1024

export class TerminalReplayScheduler {
  private readonly maxConcurrentReplayWriters: number
  private readonly sliceBytes: number
  private readonly schedule: () => Promise<void>
  private readonly queued: QueuedReplay[] = []
  private readonly active = new Set<QueuedReplay>()
  private sequence = 0
  private disposed = false

  constructor(options: TerminalReplaySchedulerOptions = {}) {
    this.maxConcurrentReplayWriters = Math.max(1, options.maxConcurrentReplayWriters ?? 1)
    this.sliceBytes = Math.max(1, options.sliceBytes ?? defaultSliceBytes)
    this.schedule = options.schedule ?? defaultSchedule
  }

  enqueue(terminalId: TerminalId, task: ReplayTask, writer: ReplayWriter): ReplayTaskHandle {
    if (this.disposed) {
      throw new Error('TerminalReplayScheduler is disposed')
    }

    const replay: QueuedReplay = {
      terminalId,
      task,
      writer,
      sequence: this.sequence++,
      cancelled: false,
      paused: false,
      resumeWaiters: [],
    }

    this.queued.push(replay)
    this.drain()

    return {
      id: task.id,
      cancel: () => {
        this.cancelQueuedReplay(replay)
      },
      pause: () => {
        replay.paused = true
      },
      resume: () => {
        this.resumeQueuedReplay(replay)
      },
    }
  }

  cancel(taskId: string): void {
    for (const replay of [...this.queued, ...this.active]) {
      if (replay.task.id === taskId) {
        this.cancelQueuedReplay(replay)
      }
    }
  }

  cancelAll(): void {
    for (const replay of [...this.queued, ...this.active]) {
      this.cancelQueuedReplay(replay)
    }
  }

  interruptForLiveOutput(terminalId: TerminalId): void {
    for (const replay of [...this.queued, ...this.active]) {
      if (replay.terminalId === terminalId && replay.task.interruptible) {
        this.cancelQueuedReplay(replay)
      }
    }
  }

  dispose(): void {
    if (this.disposed) {
      return
    }

    this.disposed = true
    this.cancelAll()
    this.queued.length = 0
  }

  private drain(): void {
    while (
      !this.disposed &&
      this.active.size < this.maxConcurrentReplayWriters &&
      this.queued.length > 0
    ) {
      const replay = this.takeNextReplay()
      if (!replay || replay.cancelled) {
        continue
      }

      this.active.add(replay)
      void this.runReplay(replay)
    }
  }

  private takeNextReplay(): QueuedReplay | undefined {
    let nextIndex = 0

    for (let index = 1; index < this.queued.length; index += 1) {
      const candidate = this.queued[index]!
      const current = this.queued[nextIndex]!
      const priorityDelta = priorityRank[candidate.task.priority] - priorityRank[current.task.priority]

      if (priorityDelta < 0 || (priorityDelta === 0 && candidate.sequence < current.sequence)) {
        nextIndex = index
      }
    }

    return this.queued.splice(nextIndex, 1)[0]
  }

  private async runReplay(replay: QueuedReplay): Promise<void> {
    let reset = false

    try {
      for await (const data of replay.task.source) {
        for (const chunk of splitByBytes(data, this.sliceBytes)) {
          await this.waitIfPaused(replay)

          if (replay.cancelled) {
            return
          }

          if (replay.task.resetBeforeWrite && !reset) {
            await replay.writer.reset?.()
            reset = true
          }

          if (replay.cancelled) {
            return
          }

          await replay.writer.write(chunk)
          await this.schedule()

          if (replay.cancelled) {
            return
          }
        }
      }
    } finally {
      this.active.delete(replay)
      this.drain()
    }
  }

  private cancelQueuedReplay(replay: QueuedReplay): void {
    replay.cancelled = true
    const queueIndex = this.queued.indexOf(replay)
    if (queueIndex !== -1) {
      this.queued.splice(queueIndex, 1)
    }
    this.resumeQueuedReplay(replay)
  }

  private resumeQueuedReplay(replay: QueuedReplay): void {
    replay.paused = false
    const waiters = replay.resumeWaiters.splice(0)
    for (const resume of waiters) {
      resume()
    }
    this.drain()
  }

  private async waitIfPaused(replay: QueuedReplay): Promise<void> {
    while (replay.paused && !replay.cancelled) {
      await new Promise<void>((resolve) => {
        replay.resumeWaiters.push(resolve)
      })
    }
  }
}

function defaultSchedule(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

function splitByBytes(data: string, maxBytes: number): string[] {
  if (new TextEncoder().encode(data).byteLength <= maxBytes) {
    return data.length === 0 ? [] : [data]
  }

  const chunks: string[] = []
  let chunk = ''
  let chunkBytes = 0
  const encoder = new TextEncoder()

  for (const char of data) {
    const charBytes = encoder.encode(char).byteLength

    if (chunk && chunkBytes + charBytes > maxBytes) {
      chunks.push(chunk)
      chunk = ''
      chunkBytes = 0
    }

    chunk += char
    chunkBytes += charBytes
  }

  if (chunk) {
    chunks.push(chunk)
  }

  return chunks
}
