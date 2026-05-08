import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MissionInboxService } from './MissionInboxService.ts'
import { MissionPaneNotifier } from './MissionPaneNotifier.ts'
import type { InboxEvent } from './inboxTypes.ts'
import type { EventHandlers } from '../workspace/WorkspaceManager.ts'
import type { PaneState, PaneStatus } from '../types.ts'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

interface FakeWorkspaceManager {
  panes: PaneState[]
  writeToPane: ReturnType<typeof vi.fn>
  onEvents: (handlers: EventHandlers) => () => void
  emitStatus: (paneId: string, status: PaneStatus) => void
}

function pane(overrides: Partial<PaneState>): PaneState {
  return {
    id: 'pane-1',
    name: 'Pane',
    agent: 'codex',
    restore: 'manual',
    isolation: 'shared',
    yolo: false,
    runtime: 'pty',
    status: 'waiting',
    meta: {},
    startedAt: '2026-05-09T00:00:00.000Z',
    ...overrides,
  }
}

function workspace(panes: PaneState[]): FakeWorkspaceManager {
  const listeners = new Set<NonNullable<EventHandlers['onPaneStatus']>>()
  return {
    panes,
    writeToPane: vi.fn(),
    onEvents: (handlers) => {
      if (handlers.onPaneStatus) listeners.add(handlers.onPaneStatus)
      return () => {
        if (handlers.onPaneStatus) listeners.delete(handlers.onPaneStatus)
      }
    },
    emitStatus: (paneId, status) => {
      const p = panes.find((candidate) => candidate.id === paneId)
      if (p) p.status = status
      for (const listener of listeners) listener(paneId, status)
    },
  }
}

function inbox(): MissionInboxService {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-pane-notifier-'))
  tempDirs.push(dir)
  return new MissionInboxService(path.join(dir, '.nexus', 'mission-inbox.json'))
}

function event(overrides: Partial<InboxEvent> = {}): InboxEvent {
  return {
    id: 'task-1:to-claim:false',
    kind: 'task-assigned',
    agentName: 'Bael',
    ref: 'task-1',
    scope: 'packages/server/src/mission',
    taskTitle: 'Implement notifier.',
    createdAt: '2026-05-09T00:00:00.000Z',
    ...overrides,
  }
}

describe('MissionPaneNotifier', () => {
  it('injects a task-assigned event into the oldest waiting worker pane and marks it delivered', () => {
    const service = inbox()
    const manager = workspace([
      pane({ id: 'new', mission: { name: 'demo', path: 'agent-team/missions/demo', role: 'mission-agent', agentName: 'Bael' }, startedAt: '2026-05-09T00:00:02.000Z' }),
      pane({ id: 'old', mission: { name: 'demo', path: 'agent-team/missions/demo', role: 'mission-agent', agentName: 'Bael' }, startedAt: '2026-05-09T00:00:01.000Z' }),
    ])
    new MissionPaneNotifier(manager as never, service).start()

    service.enqueue(event())

    expect(manager.writeToPane).toHaveBeenCalledTimes(1)
    expect(manager.writeToPane).toHaveBeenCalledWith('old', expect.stringContaining('- Task assigned: task-1 (Scope: packages/server/src/mission)'))
    expect(service.consume()).toEqual([])
  })

  it('resolves Squad Lead by mission role instead of agent name', () => {
    const service = inbox()
    const manager = workspace([
      pane({ id: 'lead', mission: { name: 'demo', path: 'agent-team/missions/demo', role: 'squad-lead', agentName: 'Squad Lead' }, status: 'idle' }),
    ])
    new MissionPaneNotifier(manager as never, service).start()

    service.enqueue(event({
      id: 'task-2:done:false',
      kind: 'review-pending',
      agentName: 'Squad Lead',
      ref: 'task-2',
      doneByAgent: 'Bael',
    }))

    expect(manager.writeToPane).toHaveBeenCalledWith('lead', expect.stringContaining('- Review pending: task-2 moved to Done by Bael'))
    expect(service.consume()).toEqual([])
  })

  it('leaves events pending when no matching pane exists', () => {
    const service = inbox()
    const manager = workspace([])
    new MissionPaneNotifier(manager as never, service).start()

    service.enqueue(event())

    expect(manager.writeToPane).not.toHaveBeenCalled()
    expect(service.consume()).toHaveLength(1)
  })

  it('queues running panes and flushes when the pane becomes idle', () => {
    const service = inbox()
    const manager = workspace([
      pane({ id: 'bael', status: 'running', mission: { name: 'demo', path: 'agent-team/missions/demo', role: 'mission-agent', agentName: 'Bael' } }),
    ])
    const notifier = new MissionPaneNotifier(manager as never, service)
    notifier.start()

    service.enqueue(event())
    expect(manager.writeToPane).not.toHaveBeenCalled()

    manager.emitStatus('bael', 'idle')

    expect(manager.writeToPane).toHaveBeenCalledTimes(1)
    expect(service.consume()).toEqual([])
  })

  it('holds stopped panes until TTL then expires events as delivered', () => {
    let now = 0
    const service = inbox()
    const manager = workspace([
      pane({ id: 'bael', status: 'stopped', mission: { name: 'demo', path: 'agent-team/missions/demo', role: 'mission-agent', agentName: 'Bael' } }),
    ])
    const notifier = new MissionPaneNotifier(manager as never, service, { ttlMs: 100, now: () => now })
    notifier.start()

    service.enqueue(event())
    now = 101
    notifier.flushPane('bael')

    expect(manager.writeToPane).not.toHaveBeenCalled()
    expect(service.consume()).toEqual([])
  })

  it('batches mixed event kinds into one pane message', () => {
    const service = inbox()
    const manager = workspace([
      pane({ id: 'bael', status: 'running', mission: { name: 'demo', path: 'agent-team/missions/demo', role: 'mission-agent', agentName: 'Bael' } }),
    ])
    new MissionPaneNotifier(manager as never, service).start()

    service.enqueue(event())
    service.enqueue(event({
      id: 'roundtable:vote:Bael',
      kind: 'roundtable-vote',
      ref: 'a2a-inbox',
      topic: 'Inbox protocol',
    }))
    service.enqueue(event({
      id: 'task-3:clarification',
      kind: 'clarification',
      ref: 'task-3',
      requesterAgent: 'Marbas',
    }))

    expect(manager.writeToPane).not.toHaveBeenCalled()

    manager.emitStatus('bael', 'waiting')

    expect(manager.writeToPane).toHaveBeenCalledTimes(1)
    const lastMessage = manager.writeToPane.mock.calls.at(-1)?.[1]
    expect(lastMessage).toContain('[Mission Inbox] You have 1 new task(s), 0 review(s) pending, 1 roundtable item(s), 1 clarification(s).')
    expect(lastMessage).toContain('- Roundtable vote: a2a-inbox (Inbox protocol)')
    expect(lastMessage).toContain('- Clarification requested: task-3 by Marbas')
  })

  it('does not mark events delivered when writeToPane throws', () => {
    const service = inbox()
    const manager = workspace([
      pane({ id: 'bael', mission: { name: 'demo', path: 'agent-team/missions/demo', role: 'mission-agent', agentName: 'Bael' } }),
    ])
    manager.writeToPane.mockImplementation(() => { throw new Error('pty write failed') })
    new MissionPaneNotifier(manager as never, service).start()

    service.enqueue(event())

    expect(service.consume()).toHaveLength(1)
  })

  it('flushPane sends pending events for a waiting pane even without a fresh enqueue', () => {
    const service = inbox()
    const manager = workspace([
      pane({ id: 'bael', status: 'running', mission: { name: 'demo', path: 'agent-team/missions/demo', role: 'mission-agent', agentName: 'Bael' } }),
    ])
    const notifier = new MissionPaneNotifier(manager as never, service)
    notifier.start()
    service.enqueue(event())
    manager.panes[0].status = 'waiting'

    notifier.flushPane('bael')

    expect(manager.writeToPane).toHaveBeenCalledTimes(1)
    expect(service.consume()).toEqual([])
  })

  it('stop unsubscribes from inbox and pane status events', () => {
    const service = inbox()
    const manager = workspace([
      pane({ id: 'bael', status: 'waiting', mission: { name: 'demo', path: 'agent-team/missions/demo', role: 'mission-agent', agentName: 'Bael' } }),
    ])
    const notifier = new MissionPaneNotifier(manager as never, service)
    notifier.start()
    notifier.stop()

    service.enqueue(event())

    expect(manager.writeToPane).not.toHaveBeenCalled()
  })

  it('formats unknown roundtable progress as a roundtable item count', () => {
    const service = inbox()
    const manager = workspace([
      pane({ id: 'lead', mission: { name: 'demo', path: 'agent-team/missions/demo', role: 'squad-lead', agentName: 'Squad Lead' } }),
    ])
    new MissionPaneNotifier(manager as never, service).start()

    service.enqueue(event({
      id: 'roundtable:progress',
      kind: 'roundtable-progress',
      agentName: 'Squad Lead',
      ref: 'a2a-inbox',
      topic: 'Inbox protocol',
    }))

    expect(manager.writeToPane).toHaveBeenCalledWith('lead', expect.stringContaining('[Mission Inbox] You have 0 new task(s), 0 review(s) pending, 1 roundtable item(s), 0 clarification(s).'))
  })
})
