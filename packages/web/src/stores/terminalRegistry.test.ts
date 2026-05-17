import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAllHistories,
  pauseTerminal,
  registerTerminalWriter,
  resetTerminalForReplay,
  finishTerminalReplay,
  resumeTerminal,
  unpauseTerminal,
  unregisterTerminalWriter,
  writeReplayToTerminal,
  writeToTerminal,
} from './terminalRegistry'

describe('terminalRegistry', () => {
  let rafCallbacks: FrameRequestCallback[]

  beforeEach(() => {
    rafCallbacks = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
  })

  afterEach(() => {
    unregisterTerminalWriter('pane-1')
    clearAllHistories()
    vi.unstubAllGlobals()
  })

  function flushAnimationFrames(): void {
    const callbacks = rafCallbacks
    rafCallbacks = []
    for (const cb of callbacks) cb(0)
  }

  it('forwards visible live output immediately so the terminal runtime owns batching', () => {
    const writes: string[] = []

    registerTerminalWriter(
      'pane-1',
      (data) => {
        writes.push(data)
      },
      { reset: vi.fn(), clear: vi.fn() } as never,
      {} as never,
    )

    writeToTerminal('pane-1', 'live-1')
    writeToTerminal('pane-1', 'live-2')

    expect(writes).toEqual(['live-1', 'live-2'])
    expect(rafCallbacks).toEqual([])
  })

  it('does not replay local terminal history when a writer is registered again', () => {
    const firstWrites: string[] = []
    const secondWrites: string[] = []

    registerTerminalWriter(
      'pane-1',
      (data) => {
        firstWrites.push(data)
      },
      { reset: vi.fn(), clear: vi.fn() } as never,
      {} as never,
    )

    writeToTerminal('pane-1', 'history-with-tui-controls')
    unregisterTerminalWriter('pane-1')

    registerTerminalWriter(
      'pane-1',
      (data) => {
        secondWrites.push(data)
      },
      { reset: vi.fn(), clear: vi.fn() } as never,
      {} as never,
    )

    expect(firstWrites).toEqual(['history-with-tui-controls'])
    expect(secondWrites).toEqual([])
  })

  it('preserves replay output when live output arrives during replay', () => {
    const writes: string[] = []

    registerTerminalWriter(
      'pane-1',
      (data) => {
        writes.push(data)
      },
      { reset: vi.fn(), clear: vi.fn() } as never,
      {} as never,
    )

    resetTerminalForReplay('pane-1')
    writeReplayToTerminal('pane-1', 'old-1')
    flushAnimationFrames()
    writeReplayToTerminal('pane-1', 'old-2')

    writeToTerminal('pane-1', 'live')
    flushAnimationFrames()

    expect(writes).toEqual(['old-1', 'old-2'])

    finishTerminalReplay('pane-1')

    expect(writes).toEqual(['old-1', 'old-2', 'live'])
  })

  it('does not reset or drop replay history when replay is resumed with pending live output', () => {
    const writes: string[] = []
    const term = { reset: vi.fn(), clear: vi.fn() }

    registerTerminalWriter(
      'pane-1',
      (data) => {
        writes.push(data)
      },
      term as never,
      {} as never,
    )

    resetTerminalForReplay('pane-1')
    writeReplayToTerminal('pane-1', 'old-1')
    flushAnimationFrames()
    writeReplayToTerminal('pane-1', 'old-2')

    writeToTerminal('pane-1', 'live')
    flushAnimationFrames()
    resumeTerminal('pane-1')

    expect(writes).toEqual(['old-1', 'old-2'])
    expect(term.reset).not.toHaveBeenCalled()

    finishTerminalReplay('pane-1')

    expect(writes).toEqual(['old-1', 'old-2', 'live'])
  })

  it('clears the visible terminal for replay without resetting terminal modes', () => {
    const term = { reset: vi.fn(), clear: vi.fn() }

    registerTerminalWriter(
      'pane-1',
      vi.fn(),
      term as never,
      {} as never,
    )

    resetTerminalForReplay('pane-1')

    expect(term.clear).toHaveBeenCalledTimes(1)
    expect(term.reset).not.toHaveBeenCalled()
  })

  it('buffers output while paused and flushes it once on unpause', () => {
    const writes: string[] = []

    registerTerminalWriter(
      'pane-1',
      (data) => {
        writes.push(data)
      },
      { reset: vi.fn(), clear: vi.fn() } as never,
      {} as never,
    )

    pauseTerminal('pane-1')
    writeToTerminal('pane-1', 'hidden-1')
    writeToTerminal('pane-1', 'hidden-2')
    flushAnimationFrames()

    expect(writes).toEqual([])

    unpauseTerminal('pane-1')

    expect(writes).toEqual(['hidden-1hidden-2'])
  })

  it('does not keep a pane paused after clearing its terminal history', () => {
    const writes: string[] = []

    registerTerminalWriter(
      'pane-1',
      (data) => {
        writes.push(data)
      },
      { reset: vi.fn(), clear: vi.fn() } as never,
      {} as never,
    )

    pauseTerminal('pane-1')
    resetTerminalForReplay('pane-1')
    writeToTerminal('pane-1', 'live')
    flushAnimationFrames()

    expect(writes).toEqual([])

    finishTerminalReplay('pane-1')

    expect(writes).toEqual(['live'])
  })

  it('does not keep panes paused after clearing all histories', () => {
    const writes: string[] = []

    registerTerminalWriter(
      'pane-1',
      (data) => {
        writes.push(data)
      },
      { reset: vi.fn(), clear: vi.fn() } as never,
      {} as never,
    )

    pauseTerminal('pane-1')
    clearAllHistories()
    writeToTerminal('pane-1', 'live')
    flushAnimationFrames()

    expect(writes).toEqual(['live'])
  })
})
