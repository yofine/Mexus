import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MissionInboxPipeline } from './MissionInboxPipeline.ts'
import type { MissionService } from './MissionService.ts'
import type { WorkspaceManager } from '../workspace/WorkspaceManager.ts'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

function tempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-inbox-pipeline-'))
  tempDirs.push(dir)
  return dir
}

function missionDetail(name: string) {
  return {
    summary: {
      name,
      path: path.join('agent-team', 'missions', name),
      lifecycle: 'active',
      complete: true,
      missingFiles: [],
      taskCounts: { toClaim: 0, inProgress: 0, done: 0 },
      unreviewedDoneCount: 0,
    },
    files: {} as never,
    kanban: {
      toClaim: [{ to: 'Bael' }],
      inProgress: [{ to: 'Vassago' }],
      done: [{ to: 'Bael' }],
    } as never,
  }
}

function missionService(activeName: string | null): Pick<MissionService, 'getActiveMission' | 'getMission'> {
  return {
    getActiveMission: vi.fn(() => activeName ? missionDetail(activeName) : null),
    getMission: vi.fn((name: string) => missionDetail(name)),
  }
}

function workspace(): Pick<WorkspaceManager, 'getPanes' | 'writeToPane' | 'onEvents'> {
  return {
    getPanes: vi.fn(() => []),
    writeToPane: vi.fn(),
    onEvents: vi.fn(() => () => {}),
  }
}

describe('MissionInboxPipeline', () => {
  it('starts notifier before watchers for the active Mission and derives a kanban roster', async () => {
    const projectDir = tempProject()
    const calls: string[] = []
    const kanbanStart = vi.fn(async () => { calls.push('kanban') })
    const roundtableStart = vi.fn(async () => { calls.push('roundtable') })
    const notifierStart = vi.fn(() => { calls.push('notifier') })

    const pipeline = new MissionInboxPipeline({
      projectDir,
      missionService: missionService('demo') as MissionService,
      workspaceManager: workspace() as WorkspaceManager,
      factories: {
        kanbanWatcher: (missionPath) => ({ start: kanbanStart, stop: vi.fn(), missionPath }),
        roundtableWatcher: (missionPath, _parser, _inbox, agentRoster) => ({ start: roundtableStart, stop: vi.fn(), missionPath, agentRoster }),
        notifier: () => ({ start: notifierStart, stop: vi.fn() }),
      },
    })

    await pipeline.start()

    expect(calls).toEqual(['notifier', 'kanban', 'roundtable'])
    expect(pipeline.getAgentRoster()).toEqual(['Bael', 'Vassago', 'Squad Lead'])
  })

  it('stays idle without active Mission and flushes on stop', async () => {
    const projectDir = tempProject()
    const flush = vi.fn()
    const pipeline = new MissionInboxPipeline({
      projectDir,
      missionService: missionService(null) as MissionService,
      workspaceManager: workspace() as WorkspaceManager,
      factories: {
        inbox: () => ({ flush } as never),
        notifier: () => ({ start: vi.fn(), stop: vi.fn() }),
        kanbanWatcher: () => ({ start: vi.fn(), stop: vi.fn() }),
        roundtableWatcher: () => ({ start: vi.fn(), stop: vi.fn() }),
      },
    })

    await pipeline.start()
    await pipeline.stop()

    expect(flush).toHaveBeenCalled()
  })

  it('restarts watchers and flushes inbox when the active Mission changes', async () => {
    const projectDir = tempProject()
    const stopped: string[] = []
    const flush = vi.fn()
    let active = 'first'
    const service = missionService(active)
    vi.mocked(service.getActiveMission).mockImplementation(() => missionDetail(active))

    const pipeline = new MissionInboxPipeline({
      projectDir,
      missionService: service as MissionService,
      workspaceManager: workspace() as WorkspaceManager,
      factories: {
        inbox: () => ({ flush } as never),
        notifier: () => ({ start: vi.fn(), stop: vi.fn() }),
        kanbanWatcher: (missionPath) => ({ start: vi.fn(), stop: vi.fn(async () => { stopped.push(`kanban:${missionPath}`) }) }),
        roundtableWatcher: (missionPath) => ({ start: vi.fn(), stop: vi.fn(async () => { stopped.push(`roundtable:${missionPath}`) }) }),
      },
    })
    await pipeline.start()

    active = 'second'
    await pipeline.restartForActiveMission()

    expect(flush).toHaveBeenCalled()
    expect(stopped).toEqual([
      `kanban:${path.join(projectDir, 'agent-team', 'missions', 'first')}`,
      `roundtable:${path.join(projectDir, 'agent-team', 'missions', 'first')}`,
    ])
  })
})
