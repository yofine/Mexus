import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import watcher from '@parcel/watcher'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MissionInboxService } from './MissionInboxService.ts'
import { MissionKanbanWatcher } from './MissionKanbanWatcher.ts'
import { MissionRoundtableWatcher } from './MissionRoundtableWatcher.ts'
import { MissionPaneNotifier } from './MissionPaneNotifier.ts'
import { parseMissionKanban, parseMissionRoundtable } from './missionParsers.ts'
import type { EventHandlers } from '../workspace/WorkspaceManager.ts'
import type { PaneState, PaneStatus } from '../types.ts'

vi.mock('@parcel/watcher', () => ({
  default: {
    subscribe: vi.fn(),
  },
}))

const tempDirs: string[] = []
let watcherCallbacks: Array<(err: Error | null, events: Array<{ path: string; type: string }>) => void> = []

beforeEach(() => {
  vi.useFakeTimers()
  watcherCallbacks = []
  vi.mocked(watcher.subscribe).mockImplementation(async (_dir, callback) => {
    watcherCallbacks.push(callback as (err: Error | null, events: Array<{ path: string; type: string }>) => void)
    return { unsubscribe: vi.fn() }
  })
})

afterEach(() => {
  vi.useRealTimers()
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  vi.clearAllMocks()
})

function pane(id: string, agentName: string, status: PaneStatus = 'idle'): PaneState {
  return {
    id,
    name: agentName,
    agent: 'codex',
    restore: 'manual',
    isolation: 'shared',
    yolo: false,
    runtime: 'pty',
    status,
    meta: {},
    startedAt: `2026-05-09T00:00:0${id.length}.000Z`,
    mission: {
      name: 'demo',
      path: 'agent-team/missions/demo',
      role: agentName === 'Squad Lead' ? 'squad-lead' : 'mission-agent',
      agentName,
    },
  }
}

function workspace(panes: PaneState[]) {
  const listeners = new Set<NonNullable<EventHandlers['onPaneStatus']>>()
  return {
    getPanes: () => panes,
    writeToPane: vi.fn(),
    onEvents: (handlers: EventHandlers) => {
      if (handlers.onPaneStatus) listeners.add(handlers.onPaneStatus)
      return () => {
        if (handlers.onPaneStatus) listeners.delete(handlers.onPaneStatus)
      }
    },
    emitStatus: (paneId: string, status: PaneStatus) => {
      const p = panes.find((candidate) => candidate.id === paneId)
      if (p) p.status = status
      for (const listener of listeners) listener(paneId, status)
    },
  }
}

function makeWorkspace() {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-inbox-e2e-'))
  tempDirs.push(projectDir)
  const missionPath = path.join(projectDir, 'agent-team', 'missions', 'demo')
  fs.mkdirSync(missionPath, { recursive: true })
  fs.writeFileSync(path.join(missionPath, 'mission.md'), '# Mission: Demo\n\nMission: `demo`\n\nLifecycle: active\n')
  fs.writeFileSync(path.join(missionPath, 'agents.md'), '# Mission Agents\n')
  fs.writeFileSync(path.join(missionPath, 'kanban.md'), kanban([]))
  fs.writeFileSync(path.join(missionPath, 'roundtable.md'), roundtable([]))
  return {
    projectDir,
    missionPath,
    kanbanPath: path.join(missionPath, 'kanban.md'),
    roundtablePath: path.join(missionPath, 'roundtable.md'),
    stateFile: path.join(projectDir, '.nexus', 'mission-inbox.json'),
  }
}

async function startPipeline(missionPath: string, stateFile: string, wm: ReturnType<typeof workspace>) {
  const inbox = new MissionInboxService(stateFile)
  const notifier = new MissionPaneNotifier(wm as never, inbox)
  const kanbanWatcher = new MissionKanbanWatcher(missionPath, parseMissionKanban, inbox)
  const roundtableWatcher = new MissionRoundtableWatcher(
    missionPath,
    parseMissionRoundtable,
    inbox,
    () => ['Bael', 'Vassago', 'Marbas', 'Squad Lead'],
  )
  notifier.start()
  await kanbanWatcher.start()
  await roundtableWatcher.start()
  return {
    inbox,
    stop: async () => {
      await kanbanWatcher.stop()
      await roundtableWatcher.stop()
      notifier.stop()
      inbox.flush()
    },
  }
}

async function trigger(filePath: string): Promise<void> {
  for (const callback of watcherCallbacks) {
    callback(null, [{ path: filePath, type: 'update' }])
  }
  await vi.advanceTimersByTimeAsync(500)
}

function task(ref: string, column: 'To Claim' | 'In Progress' | 'Done', fields: Partial<{
  to: string
  from: string
  scope: string
  request: string
  review: string
  clarification: string
}> = {}): { column: 'To Claim' | 'In Progress' | 'Done'; raw: string } {
  const lines = [
    `To: ${fields.to ?? 'Bael'} | From: ${fields.from ?? 'Squad Lead'} | Scope: \`packages/server/src/mission\``,
    `- Ref: ${ref}`,
    `- Request: ${fields.request ?? 'Implement inbox behavior.'}`,
    '- Reason: Test.',
    '- Acceptance: Test passes.',
  ]
  if (fields.clarification) lines.push(`- Clarification: ${fields.clarification}`)
  lines.push('- Result:', '- Files:', '- Verification:', `- Review: ${fields.review ?? ''}`, '- Updated: 2026-05-09, Bael')
  return { column, raw: lines.join('\n') }
}

function kanban(tasks: Array<{ column: 'To Claim' | 'In Progress' | 'Done'; raw: string }>): string {
  const section = (name: 'To Claim' | 'In Progress' | 'Done') => {
    const items = tasks.filter((item) => item.column === name).map((item) => item.raw)
    return [`## ${name}`, '', items.length ? items.join('\n\n') : 'No tasks claimed yet.'].join('\n')
  }
  return ['# Agent Team Kanban', '', section('To Claim'), '', section('In Progress'), '', section('Done'), ''].join('\n')
}

function roundtable(items: string[]): string {
  return ['# Roundtable', '', '## Pending Review', '', items.length ? items.join('\n\n') : 'No review items pending.', '', '## Approved', '', 'No review items approved yet.', '', '## Rejected', '', 'No review items rejected yet.', ''].join('\n')
}

function roundtableWithApproved(pendingItems: string[], approvedItems: string[]): string {
  return ['# Roundtable', '', '## Pending Review', '', pendingItems.length ? pendingItems.join('\n\n') : 'No review items pending.', '', '## Approved', '', approvedItems.join('\n\n'), '', '## Rejected', '', 'No review items rejected yet.', ''].join('\n')
}

function pendingReview(): string {
  return [
    'Ref: a2a-inbox',
    'Topic: Inbox protocol',
    'Opened by: Squad Lead',
    'Invitees: All',
    'Scope: `packages/server/src/mission`',
    '- Votes:',
    '  - Bael: pending - needs review.',
    '  - Vassago: pending - needs review.',
    '  - Marbas: pending - needs review.',
    '- Updated: 2026-05-09, Squad Lead',
  ].join('\n')
}

describe('Mission inbox integration', () => {
  it('injects task-assigned into an idle target pane and persists delivered state', async () => {
    const ws = makeWorkspace()
    const wm = workspace([pane('bael', 'Bael')])
    await startPipeline(ws.missionPath, ws.stateFile, wm)

    fs.writeFileSync(ws.kanbanPath, kanban([task('task-1', 'To Claim')]))
    await trigger(ws.kanbanPath)

    expect(wm.writeToPane).toHaveBeenCalledWith('bael', expect.stringContaining('- Task assigned: task-1'))
    expect(JSON.parse(fs.readFileSync(ws.stateFile, 'utf-8'))).toMatchObject({
      deduped: ['task-1:to-claim:false'],
      pending: [],
    })
  })

  it('injects review-pending into the Squad Lead pane', async () => {
    const ws = makeWorkspace()
    const wm = workspace([pane('lead', 'Squad Lead')])
    await startPipeline(ws.missionPath, ws.stateFile, wm)

    fs.writeFileSync(ws.kanbanPath, kanban([task('task-2', 'Done')]))
    await trigger(ws.kanbanPath)

    expect(wm.writeToPane).toHaveBeenCalledWith('lead', expect.stringContaining('- Review pending: task-2 moved to Done by Bael'))
  })

  it('fans out roundtable vote notifications for All invitees', async () => {
    const ws = makeWorkspace()
    const wm = workspace([pane('bael', 'Bael'), pane('vassago', 'Vassago'), pane('marbas', 'Marbas')])
    fs.writeFileSync(ws.roundtablePath, roundtableWithApproved([], [pendingReview().replace('Ref: a2a-inbox', 'Ref: baseline').replace('Invitees: All', 'Invitees: Squad Lead')]))
    await startPipeline(ws.missionPath, ws.stateFile, wm)

    fs.writeFileSync(ws.roundtablePath, roundtableWithApproved([pendingReview()], [pendingReview().replace('Ref: a2a-inbox', 'Ref: baseline').replace('Invitees: All', 'Invitees: Squad Lead')]))
    await trigger(ws.roundtablePath)

    expect(wm.writeToPane).toHaveBeenCalledWith('bael', expect.stringContaining('- Roundtable vote: a2a-inbox (Inbox protocol)'))
    expect(wm.writeToPane).toHaveBeenCalledWith('vassago', expect.stringContaining('- Roundtable vote: a2a-inbox (Inbox protocol)'))
    expect(wm.writeToPane).toHaveBeenCalledWith('marbas', expect.stringContaining('- Roundtable vote: a2a-inbox (Inbox protocol)'))
  })

  it('injects clarification requests into Squad Lead', async () => {
    const ws = makeWorkspace()
    const wm = workspace([pane('lead', 'Squad Lead')])
    fs.writeFileSync(ws.kanbanPath, kanban([task('task-3', 'In Progress')]))
    await startPipeline(ws.missionPath, ws.stateFile, wm)

    fs.writeFileSync(ws.kanbanPath, kanban([task('task-3', 'In Progress', { clarification: 'please confirm scope' })]))
    await trigger(ws.kanbanPath)

    expect(wm.writeToPane).toHaveBeenCalledWith('lead', expect.stringContaining('- Clarification requested: task-3 by Bael'))
  })

  it('does not re-inject already delivered events after restart and no-op rewrite', async () => {
    const ws = makeWorkspace()
    const firstWorkspace = workspace([pane('bael', 'Bael')])
    const first = await startPipeline(ws.missionPath, ws.stateFile, firstWorkspace)
    fs.writeFileSync(ws.kanbanPath, kanban([task('task-4', 'To Claim')]))
    await trigger(ws.kanbanPath)
    await first.stop()

    watcherCallbacks = []
    const secondWorkspace = workspace([pane('bael', 'Bael')])
    await startPipeline(ws.missionPath, ws.stateFile, secondWorkspace)
    fs.writeFileSync(ws.kanbanPath, fs.readFileSync(ws.kanbanPath, 'utf-8'))
    await trigger(ws.kanbanPath)

    expect(secondWorkspace.writeToPane).not.toHaveBeenCalled()
  })

  it('queues events while target pane is running and flushes on idle', async () => {
    const ws = makeWorkspace()
    const wm = workspace([pane('bael', 'Bael', 'running')])
    await startPipeline(ws.missionPath, ws.stateFile, wm)

    fs.writeFileSync(ws.kanbanPath, kanban([task('task-5', 'To Claim')]))
    await trigger(ws.kanbanPath)
    expect(wm.writeToPane).not.toHaveBeenCalled()

    wm.emitStatus('bael', 'idle')

    expect(wm.writeToPane).toHaveBeenCalledWith('bael', expect.stringContaining('- Task assigned: task-5'))
  })

  it('keeps inbox pipeline out of the Hub server', () => {
    const hubSource = fs.readFileSync(path.resolve(__dirname, '../hub/index.ts'), 'utf-8')

    expect(hubSource).not.toMatch(/MissionInboxPipeline|MissionPaneNotifier|MissionKanbanWatcher|MissionRoundtableWatcher/)
  })
})
