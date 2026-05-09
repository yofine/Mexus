import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import watcher from '@parcel/watcher'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MissionInboxService } from './MissionInboxService.ts'
import { MissionKanbanWatcher } from './MissionKanbanWatcher.ts'
import type { MissionKanbanParseResult, MissionKanbanTasks } from './MissionKanbanWatcher.ts'

vi.mock('@parcel/watcher', () => ({
  default: {
    subscribe: vi.fn(),
  },
}))

const tempDirs: string[] = []
let watcherCallback: ((err: Error | null, events: Array<{ path: string; type: string }>) => void) | null = null
const unsubscribe = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  watcherCallback = null
  unsubscribe.mockReset()
  vi.mocked(watcher.subscribe).mockImplementation(async (_dir, callback) => {
    watcherCallback = callback as typeof watcherCallback
    return { unsubscribe }
  })
})

afterEach(() => {
  vi.useRealTimers()
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  vi.clearAllMocks()
})

function makeMission(): { missionPath: string; kanbanPath: string; stateFile: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-kanban-watcher-'))
  tempDirs.push(dir)
  const missionPath = path.join(dir, 'agent-team', 'missions', 'demo')
  fs.mkdirSync(missionPath, { recursive: true })
  const kanbanPath = path.join(missionPath, 'kanban.md')
  fs.writeFileSync(kanbanPath, 'baseline')
  return {
    missionPath,
    kanbanPath,
    stateFile: path.join(dir, '.nexus', 'mission-inbox.json'),
  }
}

const emptyTasks: MissionKanbanTasks = {
  toClaim: [],
  inProgress: [],
  done: [],
}

function ok(tasks: Partial<MissionKanbanTasks>): MissionKanbanParseResult {
  return {
    ok: true,
    tasks: {
      ...emptyTasks,
      ...tasks,
    },
  }
}

function fail(): MissionKanbanParseResult {
  return {
    ok: false,
    raw: 'broken',
    error: 'parse failed',
    tasks: emptyTasks,
  }
}

async function trigger(kanbanPath: string): Promise<void> {
  watcherCallback?.(null, [{ path: kanbanPath, type: 'update' }])
  await vi.advanceTimersByTimeAsync(500)
}

describe('MissionKanbanWatcher', () => {
  it('establishes the first parse as baseline without emitting historical assignments', async () => {
    const { missionPath, stateFile } = makeMission()
    const inbox = new MissionInboxService(stateFile)
    const parser = vi.fn(() => ok({
      toClaim: [{
        to: 'Bael',
        from: 'Squad Lead',
        scope: 'packages/server/src/mission',
        ref: 'task-1',
        request: 'Implement watcher.',
        raw: 'task',
      }],
    }))

    await new MissionKanbanWatcher(missionPath, parser, inbox).start()

    expect(inbox.consume()).toEqual([])
  })

  it('emits task-assigned for a new To Claim block after baseline', async () => {
    const { missionPath, kanbanPath, stateFile } = makeMission()
    const inbox = new MissionInboxService(stateFile)
    const parser = vi.fn()
      .mockReturnValueOnce(ok({}))
      .mockReturnValueOnce(ok({
        toClaim: [{
          to: 'Bael',
          from: 'Squad Lead',
          scope: 'packages/server/src/mission',
          ref: 'task-1',
          request: 'Implement watcher.',
          raw: 'task',
        }],
      }))
    await new MissionKanbanWatcher(missionPath, parser, inbox).start()

    fs.writeFileSync(kanbanPath, 'next')
    await trigger(kanbanPath)

    expect(inbox.consume()).toEqual([
      expect.objectContaining({
        id: 'task-1:to-claim:false',
        kind: 'task-assigned',
        agentName: 'Bael',
        ref: 'task-1',
        scope: 'packages/server/src/mission',
        taskTitle: 'Implement watcher.',
      }),
    ])
  })

  it('emits review-pending for a Done transition with an empty review', async () => {
    const { missionPath, kanbanPath, stateFile } = makeMission()
    const inbox = new MissionInboxService(stateFile)
    const parser = vi.fn()
      .mockReturnValueOnce(ok({
        inProgress: [{
          to: 'Bael',
          from: 'Squad Lead',
          scope: 'packages/server/src/mission',
          ref: 'task-2',
          request: 'Implement service.',
          raw: 'task',
        }],
      }))
      .mockReturnValueOnce(ok({
        done: [{
          to: 'Bael',
          from: 'Squad Lead',
          scope: 'packages/server/src/mission',
          ref: 'task-2',
          request: 'Implement service.',
          review: '',
          raw: 'task',
        }],
      }))
    await new MissionKanbanWatcher(missionPath, parser, inbox).start()

    fs.writeFileSync(kanbanPath, 'done')
    await trigger(kanbanPath)

    expect(inbox.consume()).toEqual([
      expect.objectContaining({
        id: 'task-2:done:false',
        kind: 'review-pending',
        agentName: 'Squad Lead',
        ref: 'task-2',
        doneByAgent: 'Bael',
      }),
    ])
  })

  it('emits review-pending to a non-Squad Lead publisher when their task reaches Done', async () => {
    const { missionPath, kanbanPath, stateFile } = makeMission()
    const inbox = new MissionInboxService(stateFile)
    const parser = vi.fn()
      .mockReturnValueOnce(ok({}))
      .mockReturnValueOnce(ok({
        done: [{
          to: 'Bael',
          from: 'Vassago',
          scope: 'packages/server/src/mission',
          ref: 'task-5',
          request: 'Implement dependency.',
          raw: 'task',
        }],
      }))
    await new MissionKanbanWatcher(missionPath, parser, inbox).start()

    fs.writeFileSync(kanbanPath, 'done')
    await trigger(kanbanPath)

    expect(inbox.consume()).toEqual([
      expect.objectContaining({
        id: 'task-5:done:false',
        kind: 'review-pending',
        agentName: 'Vassago',
        doneByAgent: 'Bael',
      }),
    ])
  })

  it('skips In Progress echoes and parse-error markdown', async () => {
    const { missionPath, kanbanPath, stateFile } = makeMission()
    const inbox = new MissionInboxService(stateFile)
    const parser = vi.fn()
      .mockReturnValueOnce(ok({}))
      .mockReturnValueOnce(ok({
        inProgress: [{
          to: 'Bael',
          from: 'Squad Lead',
          scope: 'packages/server/src/mission',
          ref: 'task-3',
          request: 'Claimed task.',
          raw: 'task',
        }],
      }))
      .mockReturnValueOnce(fail())
    await new MissionKanbanWatcher(missionPath, parser, inbox).start()

    fs.writeFileSync(kanbanPath, 'in-progress')
    await trigger(kanbanPath)
    fs.writeFileSync(kanbanPath, 'broken')
    await trigger(kanbanPath)

    expect(inbox.consume()).toEqual([])
  })

  it('emits one clarification event when a task gains a clarification or question', async () => {
    const { missionPath, kanbanPath, stateFile } = makeMission()
    const inbox = new MissionInboxService(stateFile)
    const parser = vi.fn()
      .mockReturnValueOnce(ok({
        inProgress: [{
          to: 'Bael',
          from: 'Squad Lead',
          scope: 'packages/server/src/mission',
          ref: 'task-6',
          request: 'Clarify this task.',
          raw: 'task',
        }],
      }))
      .mockReturnValueOnce(ok({
        inProgress: [{
          to: 'Bael',
          from: 'Squad Lead',
          scope: 'packages/server/src/mission',
          ref: 'task-6',
          request: 'Clarify this task.',
          clarification: 'please confirm scope',
          raw: 'task',
        }],
      }))
      .mockReturnValueOnce(ok({
        inProgress: [{
          to: 'Bael',
          from: 'Squad Lead',
          scope: 'packages/server/src/mission',
          ref: 'task-6',
          request: 'Clarify this task.',
          clarification: 'please confirm scope',
          raw: 'task',
        }],
      }))
    await new MissionKanbanWatcher(missionPath, parser, inbox).start()

    fs.writeFileSync(kanbanPath, 'clarification')
    await trigger(kanbanPath)
    fs.writeFileSync(kanbanPath, 'same')
    await trigger(kanbanPath)

    expect(inbox.consume()).toEqual([
      expect.objectContaining({
        kind: 'clarification',
        agentName: 'Squad Lead',
        ref: 'task-6',
        taskTitle: 'Clarify this task.',
        requesterAgent: 'Bael',
      }),
    ])
  })

  it('stops the file subscription and pending debounce timer', async () => {
    const { missionPath, kanbanPath, stateFile } = makeMission()
    const inbox = new MissionInboxService(stateFile)
    const parser = vi.fn()
      .mockReturnValueOnce(ok({}))
      .mockReturnValueOnce(ok({
        toClaim: [{
          to: 'Bael',
          from: 'Squad Lead',
          scope: 'packages/server/src/mission',
          ref: 'task-4',
          request: 'Should not emit.',
          raw: 'task',
        }],
      }))
    const missionWatcher = new MissionKanbanWatcher(missionPath, parser, inbox)
    await missionWatcher.start()

    fs.writeFileSync(kanbanPath, 'next')
    watcherCallback?.(null, [{ path: kanbanPath, type: 'update' }])
    await missionWatcher.stop()
    await vi.advanceTimersByTimeAsync(500)

    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(inbox.consume()).toEqual([])
  })
})
