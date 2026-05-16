import { describe, expect, it, vi } from 'vitest'

import { MexusTerminalLaunchAdapter } from './launch-adapter'

describe('Mexus terminal launch adapter', () => {
  it('waits until the terminal is ready before writing a launch command', async () => {
    const writeInput = vi.fn()
    const adapter = new MexusTerminalLaunchAdapter({ writeInput })

    const launch = adapter.launchResolvedTerminalAgent({
      paneId: 'pane-a',
      command: 'codex',
    })
    await Promise.resolve()

    expect(writeInput).not.toHaveBeenCalled()

    adapter.markTerminalReady('pane-a')
    await launch

    expect(writeInput).toHaveBeenCalledWith('pane-a', 'codex\r')
  })

  it('does not append carriage return when autoExecute is false', async () => {
    const writeInput = vi.fn()
    const adapter = new MexusTerminalLaunchAdapter({ writeInput })

    adapter.markTerminalReady('pane-a')
    await adapter.launchResolvedTerminalAgent({
      paneId: 'pane-a',
      command: 'claude --permission-mode acceptEdits',
      autoExecute: false,
    })

    expect(writeInput).toHaveBeenCalledWith('pane-a', 'claude --permission-mode acceptEdits')
  })

  it('appends one carriage return by default without duplicating an existing one', async () => {
    const writeInput = vi.fn()
    const adapter = new MexusTerminalLaunchAdapter({ writeInput })

    adapter.markTerminalReady('pane-a')
    await adapter.launchResolvedTerminalAgent({
      paneId: 'pane-a',
      command: 'opencode\r',
    })

    expect(writeInput).toHaveBeenCalledWith('pane-a', 'opencode\r')
  })

  it('rejects pending launch when terminal readiness is rejected', async () => {
    const writeInput = vi.fn()
    const adapter = new MexusTerminalLaunchAdapter({ writeInput })
    const error = new Error('terminal failed')

    const launch = adapter.launchResolvedTerminalAgent({
      paneId: 'pane-a',
      command: 'codex',
    })
    adapter.rejectTerminalReady('pane-a', error)

    await expect(launch).rejects.toThrow('terminal failed')
    expect(writeInput).not.toHaveBeenCalled()
  })
})
