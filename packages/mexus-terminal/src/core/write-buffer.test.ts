import { describe, expect, it, vi } from 'vitest'

import { TerminalWriteBuffer, type FrameScheduler } from './write-buffer'

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

  return { callbacks, flushFrame, scheduleFrame }
}

describe('TerminalWriteBuffer', () => {
  it('writes visible live output on the next frame as a single batch', () => {
    const frames = createFrameScheduler()
    const writes: string[] = []
    const buffer = new TerminalWriteBuffer({ scheduleFrame: frames.scheduleFrame })

    buffer.setWriter((data) => writes.push(data))
    buffer.setVisible(true)

    buffer.writeLive('hello')
    buffer.writeLive(' world')

    expect(writes).toEqual([])
    expect(frames.scheduleFrame).toHaveBeenCalledTimes(1)

    frames.flushFrame()

    expect(writes).toEqual(['hello world'])
  })

  it('buffers hidden output and flushes it chunk by chunk when visible again', () => {
    const frames = createFrameScheduler()
    const writes: string[] = []
    const buffer = new TerminalWriteBuffer({ scheduleFrame: frames.scheduleFrame })

    buffer.setWriter((data) => writes.push(data))
    buffer.setVisible(false)

    buffer.writeLive('hidden ')
    buffer.writeLive('output')

    expect(frames.scheduleFrame).not.toHaveBeenCalled()
    expect(writes).toEqual([])

    buffer.setVisible(true)

    expect(frames.scheduleFrame).toHaveBeenCalledTimes(1)
    expect(writes).toEqual([])

    frames.flushFrame()

    expect(writes).toEqual(['hidden '])

    frames.flushFrame()

    expect(writes).toEqual(['hidden ', 'output'])
  })

  it('flushes later live output after clear cancels pending work', () => {
    const frames = createFrameScheduler()
    const writes: string[] = []
    const buffer = new TerminalWriteBuffer({ scheduleFrame: frames.scheduleFrame })

    buffer.setWriter((data) => writes.push(data))
    buffer.setVisible(true)

    buffer.writeLive('before clear')
    buffer.clear()
    buffer.writeLive('after clear')

    expect(frames.scheduleFrame).toHaveBeenCalledTimes(2)

    frames.flushFrame()

    expect(writes).toEqual(['after clear'])
  })

  it('keeps only the newest data when hidden backlog exceeds its bound', () => {
    const frames = createFrameScheduler()
    const writes: string[] = []
    const buffer = new TerminalWriteBuffer({
      maxBacklogBytes: 10,
      scheduleFrame: frames.scheduleFrame,
    })

    buffer.setWriter((data) => writes.push(data))
    buffer.setVisible(false)

    buffer.writeLive('12345')
    buffer.writeLive('67890')
    buffer.writeLive('abcde')
    buffer.setVisible(true)
    frames.flushFrame()
    frames.flushFrame()

    expect(writes).toEqual(['67890', 'abcde'])
  })
})
