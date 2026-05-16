import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAllHistories,
  pauseTerminal,
  registerTerminalWriter,
  resetTerminalForReplay,
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

  it('drops queued replay output when live output arrives during replay', () => {
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

    expect(writes).toEqual(['old-1', 'live'])
  })

  it('does not keep interrupted replay chunks in history', () => {
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
    resumeTerminal('pane-1')

    expect(writes).toEqual(['old-1', 'live', 'live'])
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
