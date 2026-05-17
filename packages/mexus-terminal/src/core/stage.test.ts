import { describe, expect, it, vi } from 'vitest'

import { createTuiTerminalRuntime } from './runtime'
import { TerminalStageController } from './stage'
import type { TuiTerminalSession } from './types'

function createSession(id: string): TuiTerminalSession {
  return {
    id,
    attach: vi.fn(),
    detach: vi.fn(),
    dispose: vi.fn(),
    setVisibility: vi.fn(),
    getVisibility: vi.fn(() => 'visible'),
    writeLive: vi.fn(),
    enqueueReplay: vi.fn(),
    cancelReplay: vi.fn(),
    cancelAllReplay: vi.fn(),
    restoreSnapshot: vi.fn(),
    scheduleSnapshotWrite: vi.fn(),
    fit: vi.fn(),
    refresh: vi.fn(),
    getViewport: vi.fn(() => ({ cols: 120, rows: 32 })),
  }
}

describe('TerminalStageController', () => {
  it('keeps inactive sessions visible to preserve TUI rendering while switching active session', () => {
    const runtime = createTuiTerminalRuntime()
    const controller = new TerminalStageController(runtime)
    const first = createSession('pane-a')
    const second = createSession('pane-b')
    vi.spyOn(runtime, 'createTerminal')
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)

    controller.setSessions(['pane-a', 'pane-b'])
    controller.setActiveSession('pane-a')
    controller.setActiveSession('pane-b')

    expect(first.setVisibility).toHaveBeenLastCalledWith('visible')
    expect(second.setVisibility).toHaveBeenLastCalledWith('visible')
    expect(first.dispose).not.toHaveBeenCalled()
    expect(second.dispose).not.toHaveBeenCalled()
  })

  it('writes live output to inactive sessions instead of buffering behind visibility', () => {
    const runtime = createTuiTerminalRuntime()
    const controller = new TerminalStageController(runtime)
    const first = createSession('pane-a')
    const second = createSession('pane-b')
    vi.spyOn(runtime, 'createTerminal')
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)

    controller.setSessions(['pane-a', 'pane-b'])
    controller.setActiveSession('pane-a')
    controller.writeLive('pane-b', 'background output')

    expect(second.writeLive).toHaveBeenCalledWith('background output')
  })

  it('disposes sessions that leave the stage but not sessions that only become inactive', () => {
    const runtime = createTuiTerminalRuntime()
    const controller = new TerminalStageController(runtime)
    const first = createSession('pane-a')
    const second = createSession('pane-b')
    vi.spyOn(runtime, 'createTerminal')
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)

    controller.setSessions(['pane-a', 'pane-b'])
    controller.setActiveSession('pane-b')
    controller.setSessions(['pane-b'])

    expect(first.dispose).toHaveBeenCalledTimes(1)
    expect(second.dispose).not.toHaveBeenCalled()
  })
})
