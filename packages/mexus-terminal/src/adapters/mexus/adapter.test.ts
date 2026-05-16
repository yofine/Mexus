import { describe, expect, it, vi } from 'vitest'

import type {
  ReplayTask,
  ReplayTaskHandle,
  TerminalVisibility,
  TuiTerminalRuntime,
  TuiTerminalSession,
} from '../../core/types'
import { buildMexusTerminalCacheKey } from './cache-key'
import { createMexusTerminalAdapter } from './adapter'

function createSession(id: string): TuiTerminalSession {
  return {
    id,
    attach: vi.fn(),
    detach: vi.fn(),
    dispose: vi.fn(),
    setVisibility: vi.fn(),
    getVisibility: vi.fn<() => TerminalVisibility>(() => 'visible'),
    writeLive: vi.fn(),
    enqueueReplay: vi.fn((task: ReplayTask): ReplayTaskHandle => ({
      id: task.id,
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
    })),
    cancelReplay: vi.fn(),
    cancelAllReplay: vi.fn(),
    restoreSnapshot: vi.fn(),
    scheduleSnapshotWrite: vi.fn(),
    fit: vi.fn(),
    refresh: vi.fn(),
    getViewport: vi.fn(() => ({ cols: 120, rows: 32 })),
  }
}

function createRuntime() {
  const sessions = new Map<string, TuiTerminalSession>()
  const runtime: TuiTerminalRuntime = {
    createTerminal: vi.fn(({ id }) => {
      const session = createSession(id)
      sessions.set(id, session)
      return session
    }),
    getTerminal: vi.fn((id) => sessions.get(id)),
    disposeTerminal: vi.fn((id) => {
      sessions.delete(id)
    }),
    dispose: vi.fn(),
  }

  return { runtime, sessions }
}

async function collect(source: ReplayTask['source']): Promise<string[]> {
  const chunks: string[] = []
  for await (const chunk of source) {
    chunks.push(chunk)
  }
  return chunks
}

describe('Mexus terminal adapter', () => {
  it('maps terminal.output to live session writes', () => {
    const { runtime, sessions } = createRuntime()
    const adapter = createMexusTerminalAdapter({ runtime, workspaceKey: 'workspace-a' })

    adapter.handleEvent({ type: 'terminal.output', paneId: 'pane-a', data: 'live' })

    expect(runtime.createTerminal).toHaveBeenCalledWith({
      id: 'pane-a',
      cacheKey: 'mexus:v1:workspace-a:pane-a:none:120',
    })
    expect(sessions.get('pane-a')?.writeLive).toHaveBeenCalledWith('live')
  })

  it('uses writeLive for live output while replay is pending so the session can interrupt it', () => {
    const { runtime, sessions } = createRuntime()
    const adapter = createMexusTerminalAdapter({
      runtime,
      workspaceKey: 'workspace-a',
      activePaneId: 'pane-a',
    })

    adapter.handleEvent({
      type: 'terminal.replay.start',
      paneId: 'pane-a',
      replayId: 'replay-a',
      kind: 'head',
      sessionKey: 'session-a',
      cols: 80,
    })
    adapter.handleEvent({ type: 'terminal.replay.chunk', paneId: 'pane-a', replayId: 'replay-a', data: 'old' })
    adapter.handleEvent({ type: 'terminal.replay.end', paneId: 'pane-a', replayId: 'replay-a' })
    adapter.handleEvent({ type: 'terminal.output', paneId: 'pane-a', data: 'new' })

    const session = sessions.get('pane-a')
    expect(session?.enqueueReplay).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'replay-a',
        kind: 'head',
        priority: 'critical',
        interruptible: true,
        resetBeforeWrite: true,
      }),
    )
    expect(session?.writeLive).toHaveBeenCalledWith('new')
  })

  it('disposes and cancels known sessions when the workspace resets', () => {
    const { runtime, sessions } = createRuntime()
    const adapter = createMexusTerminalAdapter({ runtime, workspaceKey: 'workspace-a' })

    adapter.handleEvent({ type: 'terminal.output', paneId: 'pane-a', data: 'a' })
    adapter.handleEvent({ type: 'terminal.output', paneId: 'pane-b', data: 'b' })
    const sessionA = sessions.get('pane-a')
    const sessionB = sessions.get('pane-b')

    adapter.resetWorkspace()

    expect(sessionA?.cancelAllReplay).toHaveBeenCalledTimes(1)
    expect(sessionB?.cancelAllReplay).toHaveBeenCalledTimes(1)
    expect(runtime.disposeTerminal).toHaveBeenCalledWith('pane-a')
    expect(runtime.disposeTerminal).toHaveBeenCalledWith('pane-b')
  })

  it('includes cols in Mexus terminal cache keys', () => {
    expect(
      buildMexusTerminalCacheKey({
        workspaceKey: 'workspace-a',
        paneId: 'pane-a',
        sessionKey: 'session-a',
        cols: 132,
      }),
    ).toBe('mexus:v1:workspace-a:pane-a:session-a:132')
  })

  it('builds replay tasks from buffered chunks with inactive priorities', async () => {
    const { sessions, runtime } = createRuntime()
    const adapter = createMexusTerminalAdapter({
      runtime,
      workspaceKey: 'workspace-a',
      activePaneId: 'pane-a',
    })

    adapter.handleEvent({
      type: 'terminal.replay.start',
      paneId: 'pane-b',
      replayId: 'replay-b',
      kind: 'head',
      cols: 100,
    })
    adapter.handleEvent({ type: 'terminal.replay.chunk', paneId: 'pane-b', replayId: 'replay-b', data: 'one' })
    adapter.handleEvent({ type: 'terminal.replay.chunk', paneId: 'pane-b', replayId: 'replay-b', data: 'two' })
    adapter.handleEvent({ type: 'terminal.replay.end', paneId: 'pane-b', replayId: 'replay-b' })

    const session = sessions.get('pane-b')
    expect(session).toBeDefined()
    const task = vi.mocked(session!.enqueueReplay).mock.calls[0]?.[0]
    expect(task).toBeDefined()
    expect(task).toMatchObject({
      id: 'replay-b',
      kind: 'head',
      priority: 'normal',
      interruptible: true,
    })
    expect(await collect(task!.source)).toEqual(['one', 'two'])
  })
})
