import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MissionInboxService } from './MissionInboxService.ts'
import type { InboxEvent } from './inboxTypes.ts'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

function makeStateFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-inbox-'))
  tempDirs.push(dir)
  return path.join(dir, '.nexus', 'mission-inbox.json')
}

function event(overrides: Partial<InboxEvent> = {}): InboxEvent {
  return {
    id: 'task-1:to-claim:false',
    kind: 'task-assigned',
    agentName: 'Bael',
    ref: 'task-1',
    scope: 'packages/server/src/mission',
    taskTitle: 'Implement inbox service.',
    createdAt: '2026-05-09T00:00:00.000Z',
    ...overrides,
  }
}

describe('MissionInboxService', () => {
  it('persists pending events and deduplicates them across restarts', () => {
    const stateFile = makeStateFile()
    const first = new MissionInboxService(stateFile)

    expect(first.enqueue(event())).toBe(true)
    expect(first.enqueue(event())).toBe(false)
    expect(first.consume()).toHaveLength(1)

    const second = new MissionInboxService(stateFile)
    expect(second.enqueue(event())).toBe(false)
    expect(second.consume()).toHaveLength(1)
    expect(JSON.parse(fs.readFileSync(stateFile, 'utf-8'))).toEqual({
      deduped: ['task-1:to-claim:false'],
      pending: [event()],
    })
  })

  it('filters pending events by agent and removes delivered events', () => {
    const service = new MissionInboxService(makeStateFile())
    service.enqueue(event())
    service.enqueue(event({
      id: 'task-2:done:false',
      kind: 'review-pending',
      agentName: 'Squad Lead',
      ref: 'task-2',
      doneByAgent: 'Bael',
    }))

    expect(service.getPending('Bael')).toEqual([event()])

    service.markDelivered('task-1:to-claim:false')

    expect(service.consume()).toEqual([
      expect.objectContaining({ id: 'task-2:done:false', agentName: 'Squad Lead' }),
    ])
  })

  it('notifies subscribers only when an event is newly enqueued', () => {
    const service = new MissionInboxService(makeStateFile())
    const listener = vi.fn()
    service.onEnqueue(listener)

    service.enqueue(event())
    service.enqueue(event())

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(event())
  })
})
