import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SessionRecorder } from './SessionRecorder.ts'
import type { PaneState } from '../types.ts'

const tempDirs: string[] = []

function makeProjectDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-session-recorder-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

function pane(overrides: Partial<PaneState> = {}): PaneState {
  return {
    id: 'pane-1',
    name: 'Claude',
    agent: 'claudecode',
    restore: 'manual',
    isolation: 'shared',
    yolo: false,
    runtime: 'pty',
    status: 'running',
    meta: {},
    ...overrides,
  }
}

describe('SessionRecorder terminal input history', () => {
  it('records committed user input in replay turns without relying on PTY echo', () => {
    const projectDir = makeProjectDir()
    const recorder = new SessionRecorder(projectDir, 'Nexus')

    recorder.onPaneAdded(pane())
    recorder.onTerminalInput('pane-1', 'summarize')
    recorder.onTerminalInput('pane-1', ' this')
    recorder.onTerminalInput('pane-1', '\r')
    recorder.onTerminalData('pane-1', 'assistant output')
    recorder.flush()

    const [summary] = SessionRecorder.listSessions(projectDir)
    expect(summary).toBeTruthy()

    const session = SessionRecorder.getSession(projectDir, summary.id)
    expect(session?.turns).toHaveLength(1)

    const turn = SessionRecorder.getTurn(projectDir, summary.id, session!.turns[0].id)
    expect(turn?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'input',
          paneId: 'pane-1',
          data: 'summarize this',
        }),
        expect.objectContaining({
          type: 'terminal',
          paneId: 'pane-1',
          data: 'assistant output',
        }),
      ]),
    )
  })

  it('records interrupt input and handles backspace in pending user text', () => {
    const projectDir = makeProjectDir()
    const recorder = new SessionRecorder(projectDir, 'Nexus')

    recorder.onPaneAdded(pane())
    recorder.onTerminalInput('pane-1', 'abc')
    recorder.onTerminalInput('pane-1', '\u007f')
    recorder.onTerminalInput('pane-1', '\r')
    recorder.onTerminalInput('pane-1', '\u0003')
    recorder.flush()

    const [summary] = SessionRecorder.listSessions(projectDir)
    const session = SessionRecorder.getSession(projectDir, summary.id)
    const turn = SessionRecorder.getTurn(projectDir, summary.id, session!.turns[0].id)

    expect(turn?.events.filter((event) => event.type === 'input').map((event) => event.data))
      .toEqual(['ab', '^C'])
  })
})
