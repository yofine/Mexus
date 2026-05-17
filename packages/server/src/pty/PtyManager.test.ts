import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PtyManager } from './PtyManager.ts'
import type { AgentDefinition, PaneConfig } from '../types.ts'

let lastPty: MockPty | null = null

class MockPty {
  pid = 1234
  private dataCallbacks: Array<(data: string) => void> = []
  private exitCallbacks: Array<(event: { exitCode: number }) => void> = []

  onData(callback: (data: string) => void): void {
    this.dataCallbacks.push(callback)
  }

  onExit(callback: (event: { exitCode: number }) => void): void {
    this.exitCallbacks.push(callback)
  }

  write(data: string): void {
    const match = data.match(/echo (__NEXUS_RDY_[^\r]+)\r/)
    if (match) this.emitData(`${match[1]}\r\n`)
  }

  resize(): void {}
  kill(): void {}

  emitData(data: string): void {
    for (const callback of this.dataCallbacks) callback(data)
  }

  emitExit(exitCode: number): void {
    for (const callback of this.exitCallbacks) callback({ exitCode })
  }
}

vi.mock('node-pty', () => ({
  spawn: vi.fn(() => {
    lastPty = new MockPty()
    return lastPty
  }),
}))

const agent: AgentDefinition = {
  bin: 'claude',
  continue_flag: '--continue',
  statusline: false,
}

const pane: PaneConfig = {
  id: 'pane-1',
  name: 'Worker',
  agent: 'claudecode',
  restore: 'restart',
  isolation: 'shared',
  yolo: false,
}

function configManager() {
  return {
    getShell: () => '/bin/sh',
    getProjectDir: () => process.cwd(),
    getAgentDefinition: () => agent,
  }
}

describe('PtyManager logging', () => {
  beforeEach(() => {
    lastPty = null
    vi.restoreAllMocks()
  })

  it('does not write normal PTY startup progress to stdout', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const manager = new PtyManager(configManager() as never)

    manager.spawn('pane-1', pane)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(log).not.toHaveBeenCalledWith(expect.stringContaining('[PTY]'))
  })
})
