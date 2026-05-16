import { describe, expect, it, vi } from 'vitest'

import { TerminalReplayScheduler, type ReplayWriter } from './scheduler'
import type { ReplayTask } from './types'

function task(
  id: string,
  source: Iterable<string> | AsyncIterable<string>,
  options: Partial<ReplayTask> = {},
): ReplayTask {
  return {
    id,
    kind: 'history',
    priority: 'normal',
    source,
    ...options,
  }
}

function createWriter(): ReplayWriter & { writes: string[]; resets: number } {
  return {
    writes: [],
    resets: 0,
    write(data: string) {
      this.writes.push(data)
    },
    reset() {
      this.resets += 1
    },
  }
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function tick(turns = 3) {
  for (let index = 0; index < turns; index += 1) {
    await Promise.resolve()
  }
}

async function flush() {
  await new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
  await tick()
}

describe('TerminalReplayScheduler', () => {
  it('runs one replay writer at a time by default and drains by priority', async () => {
    const gates = [deferred(), deferred(), deferred()]
    const schedule = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(() => gates[0]!.promise)
      .mockImplementationOnce(() => gates[1]!.promise)
      .mockImplementationOnce(() => gates[2]!.promise)
    const scheduler = new TerminalReplayScheduler({ sliceBytes: 1, schedule })
    const writer = createWriter()

    scheduler.enqueue('terminal-a', task('background', ['b'], { priority: 'background' }), writer)
    scheduler.enqueue('terminal-a', task('critical', ['c'], { priority: 'critical' }), writer)
    scheduler.enqueue('terminal-a', task('high', ['h'], { priority: 'high' }), writer)
    await tick()

    expect(writer.writes).toEqual(['b'])

    gates[0]!.resolve()
    await flush()
    expect(writer.writes).toEqual(['b', 'c'])

    gates[1]!.resolve()
    await flush()
    expect(writer.writes).toEqual(['b', 'c', 'h'])

    gates[2]!.resolve()
    await flush()
  })

  it('splits replay output by sliceBytes and yields through schedule between chunks', async () => {
    const schedule = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const scheduler = new TerminalReplayScheduler({ sliceBytes: 3, schedule })
    const writer = createWriter()

    scheduler.enqueue('terminal-a', task('normal', ['abcdefg']), writer)
    await flush()

    expect(writer.writes).toEqual(['abc', 'def', 'g'])
    expect(schedule).toHaveBeenCalledTimes(3)
  })

  it('resets only once before the first written chunk', async () => {
    const scheduler = new TerminalReplayScheduler({ sliceBytes: 2, schedule: async () => {} })
    const writer = createWriter()

    scheduler.enqueue(
      'terminal-a',
      task('reset', ['abcd', 'ef'], { resetBeforeWrite: true }),
      writer,
    )
    await flush()

    expect(writer.resets).toBe(1)
    expect(writer.writes).toEqual(['ab', 'cd', 'ef'])
  })

  it('stops writing remaining chunks after cancel', async () => {
    const gate = deferred()
    const scheduler = new TerminalReplayScheduler({ sliceBytes: 2, schedule: () => gate.promise })
    const writer = createWriter()

    const handle = scheduler.enqueue('terminal-a', task('cancel-me', ['abcdef']), writer)
    await tick()

    expect(writer.writes).toEqual(['ab'])
    handle.cancel()
    gate.resolve()
    await flush()

    expect(writer.writes).toEqual(['ab'])
  })

  it('cancels queued tasks by id and all pending replay tasks', async () => {
    const gate = deferred()
    const scheduler = new TerminalReplayScheduler({ sliceBytes: 1, schedule: () => gate.promise })
    const writer = createWriter()

    scheduler.enqueue('terminal-a', task('running', ['r']), writer)
    scheduler.enqueue('terminal-a', task('cancelled', ['c']), writer)
    scheduler.enqueue('terminal-a', task('also-cancelled', ['a']), writer)
    await tick()

    scheduler.cancel('cancelled')
    scheduler.cancelAll()
    gate.resolve()
    await flush()

    expect(writer.writes).toEqual(['r'])
  })

  it('interrupts only interruptible replays for the same terminal', async () => {
    const gate = deferred()
    const scheduler = new TerminalReplayScheduler({ sliceBytes: 1, schedule: () => gate.promise })
    const writerA = createWriter()
    const writerB = createWriter()

    scheduler.enqueue('terminal-a', task('a-interruptible', ['ab'], { interruptible: true }), writerA)
    scheduler.enqueue('terminal-b', task('b-interruptible', ['bc'], { interruptible: true }), writerB)
    scheduler.enqueue('terminal-a', task('a-locked', ['cd'], { interruptible: false }), writerA)
    await tick()

    expect(writerA.writes).toEqual(['a'])
    scheduler.interruptForLiveOutput('terminal-a')
    gate.resolve()
    await flush()

    expect(writerA.writes).toEqual(['a', 'c', 'd'])
    expect(writerB.writes).toEqual(['b', 'c'])
  })

  it('disposes by cancelling queued work and rejecting new enqueue attempts', async () => {
    const gate = deferred()
    const scheduler = new TerminalReplayScheduler({ sliceBytes: 1, schedule: () => gate.promise })
    const writer = createWriter()

    scheduler.enqueue('terminal-a', task('running', ['ab']), writer)
    scheduler.enqueue('terminal-a', task('queued', ['q']), writer)
    await tick()

    scheduler.dispose()
    gate.resolve()
    await flush()

    expect(writer.writes).toEqual(['a'])
    expect(() => scheduler.enqueue('terminal-a', task('new', ['n']), writer)).toThrow(
      /disposed/i,
    )
  })
})
