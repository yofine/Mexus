import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import watcher from '@parcel/watcher'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MissionInboxService } from './MissionInboxService.ts'
import { MissionRoundtableWatcher } from './MissionRoundtableWatcher.ts'
import type { MissionRoundtableParseResult, RoundtableItem } from './missionParsers.ts'

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

function makeMission(): { missionPath: string; roundtablePath: string; stateFile: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-roundtable-watcher-'))
  tempDirs.push(dir)
  const missionPath = path.join(dir, 'agent-team', 'missions', 'demo')
  fs.mkdirSync(missionPath, { recursive: true })
  const roundtablePath = path.join(missionPath, 'roundtable.md')
  fs.writeFileSync(roundtablePath, 'baseline')
  return {
    missionPath,
    roundtablePath,
    stateFile: path.join(dir, '.nexus', 'mission-inbox.json'),
  }
}

function item(overrides: Partial<RoundtableItem> = {}): RoundtableItem {
  return {
    section: 'Pending Review',
    ref: 'a2a-inbox',
    topic: 'Mission Agent A2A inbox notification mechanism',
    openedBy: 'Squad Lead',
    invitees: ['Bael'],
    scope: 'packages/server/src/mission',
    votes: [{ agent: 'Bael', vote: 'pending' }],
    raw: 'Ref: a2a-inbox',
    line: 1,
    ...overrides,
  }
}

function ok(items: RoundtableItem[]): MissionRoundtableParseResult {
  return { ok: true, raw: 'roundtable', items }
}

function fail(): MissionRoundtableParseResult {
  return { ok: false, raw: 'broken', error: 'parse failed', items: [] }
}

async function trigger(roundtablePath: string): Promise<void> {
  watcherCallback?.(null, [{ path: roundtablePath, type: 'update' }])
  await vi.advanceTimersByTimeAsync(500)
}

describe('MissionRoundtableWatcher', () => {
  it('emits roundtable-vote for an explicit pending invitee after baseline', async () => {
    const { missionPath, roundtablePath, stateFile } = makeMission()
    const inbox = new MissionInboxService(stateFile)
    const parser = vi.fn()
      .mockReturnValueOnce(ok([]))
      .mockReturnValueOnce(ok([item()]))

    await new MissionRoundtableWatcher(missionPath, parser, inbox, () => []).start()

    fs.writeFileSync(roundtablePath, 'next')
    await trigger(roundtablePath)

    expect(inbox.consume()).toEqual([
      expect.objectContaining({
        kind: 'roundtable-vote',
        agentName: 'Bael',
        ref: 'a2a-inbox',
        topic: 'Mission Agent A2A inbox notification mechanism',
      }),
    ])
  })

  it('fans out All invitees against the lazy agent roster', async () => {
    const { missionPath, roundtablePath, stateFile } = makeMission()
    const inbox = new MissionInboxService(stateFile)
    const agentRoster = vi.fn(() => ['Bael', 'Vassago', 'Marbas'])
    const parser = vi.fn()
      .mockReturnValueOnce(ok([]))
      .mockReturnValueOnce(ok([item({
        invitees: ['All'],
        votes: [
          { agent: 'Bael', vote: 'pending' },
          { agent: 'Vassago', vote: 'pending' },
        ],
      })]))

    await new MissionRoundtableWatcher(missionPath, parser, inbox, agentRoster).start()

    fs.writeFileSync(roundtablePath, 'next')
    await trigger(roundtablePath)

    expect(agentRoster).toHaveBeenCalledTimes(1)
    expect(inbox.consume()).toEqual([
      expect.objectContaining({ kind: 'roundtable-vote', agentName: 'Bael' }),
      expect.objectContaining({ kind: 'roundtable-vote', agentName: 'Vassago' }),
    ])
  })

  it('emits roundtable-progress to the opener when a vote becomes non-pending', async () => {
    const { missionPath, roundtablePath, stateFile } = makeMission()
    const inbox = new MissionInboxService(stateFile)
    const parser = vi.fn()
      .mockReturnValueOnce(ok([item()]))
      .mockReturnValueOnce(ok([item({
        votes: [{ agent: 'Bael', vote: 'approve', reason: 'ready' }],
      })]))

    await new MissionRoundtableWatcher(missionPath, parser, inbox, () => []).start()

    fs.writeFileSync(roundtablePath, 'next')
    await trigger(roundtablePath)

    expect(inbox.consume()).toEqual([
      expect.objectContaining({
        kind: 'roundtable-progress',
        agentName: 'Squad Lead',
        ref: 'a2a-inbox',
      }),
    ])
  })

  it('does not re-emit progress on a no-op rewrite', async () => {
    const { missionPath, roundtablePath, stateFile } = makeMission()
    const inbox = new MissionInboxService(stateFile)
    const approved = item({ votes: [{ agent: 'Bael', vote: 'approve' }] })
    const parser = vi.fn()
      .mockReturnValueOnce(ok([item()]))
      .mockReturnValueOnce(ok([approved]))
      .mockReturnValueOnce(ok([approved]))

    await new MissionRoundtableWatcher(missionPath, parser, inbox, () => []).start()

    fs.writeFileSync(roundtablePath, 'next')
    await trigger(roundtablePath)
    fs.writeFileSync(roundtablePath, 'same')
    await trigger(roundtablePath)

    expect(inbox.consume()).toHaveLength(1)
  })

  it('skips parse-error markdown and stops its subscription', async () => {
    const { missionPath, roundtablePath, stateFile } = makeMission()
    const inbox = new MissionInboxService(stateFile)
    const parser = vi.fn()
      .mockReturnValueOnce(ok([]))
      .mockReturnValueOnce(fail())

    const roundtableWatcher = new MissionRoundtableWatcher(missionPath, parser, inbox, () => [])
    await roundtableWatcher.start()
    fs.writeFileSync(roundtablePath, 'broken')
    watcherCallback?.(null, [{ path: roundtablePath, type: 'update' }])
    await roundtableWatcher.stop()
    await vi.advanceTimersByTimeAsync(500)

    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(inbox.consume()).toEqual([])
  })
})
