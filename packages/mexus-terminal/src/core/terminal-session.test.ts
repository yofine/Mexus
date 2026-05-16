import type { FitAddon } from '@xterm/addon-fit'
import type { Terminal } from '@xterm/xterm'
import { describe, expect, it, vi } from 'vitest'

import { createTuiTerminalRuntime } from './runtime'
import { TuiTerminalSession } from './terminal-session'
import type { FrameScheduler } from './write-buffer'

function createFrameScheduler() {
  const callbacks = new Map<number, FrameRequestCallback>()
  let nextHandle = 1

  const scheduleFrame: FrameScheduler = vi.fn((callback) => {
    const handle = nextHandle++
    callbacks.set(handle, callback)
    return handle
  })

  const flushFrame = () => {
    const entries = [...callbacks.entries()]
    callbacks.clear()
    for (const [, callback] of entries) {
      callback(0)
    }
  }

  return { flushFrame, scheduleFrame }
}

function createTerminal(options: Partial<Pick<Terminal, 'cols' | 'rows'>> = {}) {
  const writes: string[] = []
  const writeMock = vi.fn((data: string) => {
    writes.push(data)
  })
  const terminal = {
    cols: options.cols ?? 80,
    rows: options.rows ?? 24,
    write: writeMock,
    clear: vi.fn(),
    refresh: vi.fn(),
  } as unknown as Terminal

  return { terminal, writeMock, writes }
}

function createFitAddon() {
  return { fit: vi.fn() } as unknown as FitAddon
}

async function tick(turns = 3) {
  for (let index = 0; index < turns; index += 1) {
    await Promise.resolve()
  }
}

describe('TuiTerminalSession', () => {
  it('interrupts replay before writing live output', () => {
    const frames = createFrameScheduler()
    const scheduler = {
      enqueue: vi.fn(),
      cancel: vi.fn(),
      cancelAll: vi.fn(),
      dispose: vi.fn(),
      interruptForLiveOutput: vi.fn(),
    }
    const session = new TuiTerminalSession('terminal-a', {
      replayScheduler: scheduler,
      writeBufferOptions: { scheduleFrame: frames.scheduleFrame },
    })
    const { terminal, writeMock, writes } = createTerminal()
    session.attach(terminal)

    session.writeLive('live')

    expect(scheduler.interruptForLiveOutput).toHaveBeenCalledWith('terminal-a')
    expect(writes).toEqual([])

    frames.flushFrame()

    expect(writes).toEqual(['live'])
    expect(scheduler.interruptForLiveOutput.mock.invocationCallOrder[0]).toBeLessThan(
      writeMock.mock.invocationCallOrder[0],
    )
  })

  it('visibility controls buffering', () => {
    const frames = createFrameScheduler()
    const session = new TuiTerminalSession('terminal-a', {
      writeBufferOptions: { scheduleFrame: frames.scheduleFrame },
    })
    const { terminal, writes } = createTerminal()
    session.attach(terminal)

    session.setVisibility('hidden')
    session.writeLive('hidden')
    frames.flushFrame()

    expect(writes).toEqual([])

    session.setVisibility('visible')
    frames.flushFrame()

    expect(writes).toEqual(['hidden'])
  })

  it('detach removes writer but keeps session usable after reattach', () => {
    const frames = createFrameScheduler()
    const session = new TuiTerminalSession('terminal-a', {
      writeBufferOptions: { scheduleFrame: frames.scheduleFrame },
    })
    const first = createTerminal()
    const second = createTerminal()

    session.attach(first.terminal)
    session.detach()
    session.writeLive('while detached')
    frames.flushFrame()

    expect(first.writes).toEqual([])

    session.attach(second.terminal)
    frames.flushFrame()

    expect(second.writes).toEqual(['while detached'])
  })

  it('dispose clears replay and buffers', () => {
    const frames = createFrameScheduler()
    const scheduler = {
      enqueue: vi.fn(),
      cancel: vi.fn(),
      cancelAll: vi.fn(),
      dispose: vi.fn(),
      interruptForLiveOutput: vi.fn(),
    }
    const session = new TuiTerminalSession('terminal-a', {
      replayScheduler: scheduler,
      ownsReplayScheduler: true,
      writeBufferOptions: { scheduleFrame: frames.scheduleFrame },
    })
    const { terminal, writes } = createTerminal()

    session.attach(terminal)
    session.writeLive('pending')
    session.dispose()
    frames.flushFrame()

    expect(writes).toEqual([])
    expect(scheduler.cancelAll).toHaveBeenCalledTimes(1)
    expect(scheduler.dispose).toHaveBeenCalledTimes(1)
  })

  it('does not dispose injected replay scheduler unless it owns it', () => {
    const scheduler = {
      enqueue: vi.fn(),
      cancel: vi.fn(),
      cancelAll: vi.fn(),
      dispose: vi.fn(),
      interruptForLiveOutput: vi.fn(),
    }
    const session = new TuiTerminalSession('terminal-a', {
      replayScheduler: scheduler,
      ownsReplayScheduler: false,
    })

    session.dispose()

    expect(scheduler.cancelAll).toHaveBeenCalledTimes(1)
    expect(scheduler.dispose).not.toHaveBeenCalled()
  })

  it('fit catches errors', () => {
    const session = new TuiTerminalSession('terminal-a')
    const { terminal } = createTerminal()
    const fitAddon = { fit: vi.fn(() => { throw new Error('fit failed') }) } as unknown as FitAddon

    session.attach(terminal, fitAddon)

    expect(() => session.fit()).not.toThrow()
  })

  it('reports viewport from attached xterm', () => {
    const session = new TuiTerminalSession('terminal-a')
    const { terminal } = createTerminal({ cols: 120, rows: 32 })

    expect(session.getViewport()).toBeNull()

    session.attach(terminal)

    expect(session.getViewport()).toEqual({ cols: 120, rows: 32 })
  })

  it('writes compatible snapshots to the attached terminal', async () => {
    const frames = createFrameScheduler()
    const session = new TuiTerminalSession('terminal-a', {
      snapshotStore: {
        read: vi.fn(async () => ({
          cacheKey: 'terminal-a',
          terminalId: 'terminal-a',
          cols: 80,
          rows: 24,
          data: 'snapshot',
          createdAt: 1,
          updatedAt: 1,
          bytes: 8,
          schemaVersion: 1 as const,
        })),
      },
      writeBufferOptions: { scheduleFrame: frames.scheduleFrame },
    })
    const { terminal, writes } = createTerminal({ cols: 80, rows: 24 })
    session.attach(terminal)

    await expect(
      session.restoreSnapshot({ cacheKey: 'terminal-a', viewport: { cols: 80, rows: 24 } }),
    ).resolves.toEqual({ restored: true })
    frames.flushFrame()

    expect(writes).toEqual(['snapshot'])
  })
})

describe('createTuiTerminalRuntime', () => {
  it('creating an existing id disposes the old session', () => {
    const runtime = createTuiTerminalRuntime()
    const first = runtime.createTerminal({ id: 'terminal-a' })
    const dispose = vi.spyOn(first, 'dispose')

    const second = runtime.createTerminal({ id: 'terminal-a' })

    expect(dispose).toHaveBeenCalledTimes(1)
    expect(runtime.getTerminal('terminal-a')).toBe(second)
  })

  it('disposeTerminal and dispose clean up sessions', async () => {
    const runtime = createTuiTerminalRuntime()
    const first = runtime.createTerminal({ id: 'terminal-a' })
    const second = runtime.createTerminal({ id: 'terminal-b' })
    const firstDispose = vi.spyOn(first, 'dispose')
    const secondDispose = vi.spyOn(second, 'dispose')

    runtime.disposeTerminal('terminal-a')
    expect(firstDispose).toHaveBeenCalledTimes(1)
    expect(runtime.getTerminal('terminal-a')).toBeUndefined()
    expect(runtime.getTerminal('terminal-b')).toBe(second)

    runtime.dispose()
    await tick()

    expect(secondDispose).toHaveBeenCalledTimes(1)
    expect(runtime.getTerminal('terminal-b')).toBeUndefined()
  })

  it('attaches xterm and fitAddon when creating a terminal', () => {
    const runtime = createTuiTerminalRuntime()
    const { terminal } = createTerminal()
    const fitAddon = createFitAddon()

    const session = runtime.createTerminal({ id: 'terminal-a', xterm: terminal, fitAddon })

    session.writeLive('live')
    expect(session.getViewport()).toEqual({ cols: 80, rows: 24 })
    expect(() => session.fit()).not.toThrow()
  })
})
