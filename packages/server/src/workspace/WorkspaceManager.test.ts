import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ConfigManager } from './ConfigManager.ts'
import { WorkspaceManager } from './WorkspaceManager.ts'
import type { PaneConfig, PaneState, WorkspaceConfig } from '../types.ts'

const tempDirs: string[] = []

function makeProjectDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-workspace-manager-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('WorkspaceManager pane title persistence', () => {
  it('renames only pane title while preserving mission metadata and pane config', async () => {
    const projectDir = makeProjectDir()
    const configManager = new ConfigManager(projectDir)
    const mission = {
      name: 'hub-agent-team-mission-mvp',
      path: 'agent-team/missions/hub-agent-team-mission-mvp',
      role: 'mission-agent' as const,
      agentName: 'Marbas',
    }
    const paneConfig: PaneConfig = {
      id: 'pane-1',
      name: 'Marbas - hub-agent-team-mission-mvp',
      agent: 'codex',
      workdir: 'packages/web',
      task: 'Original task',
      mission,
      restore: 'restart',
      isolation: 'shared',
      yolo: false,
      sessionId: 'session-1',
    }
    const workspaceConfig: WorkspaceConfig = {
      version: '1',
      name: 'Nexus',
      repository: { path: '.', git: false },
      panes: [paneConfig],
    }
    configManager.saveWorkspaceConfig(workspaceConfig)

    const manager = new WorkspaceManager(configManager)
    const paneState: PaneState = {
      ...paneConfig,
      runtime: 'pty',
      status: 'running',
      meta: {},
    }
    ;(manager as unknown as { panes: Map<string, PaneState> }).panes.set('pane-1', paneState)

    manager.renamePane('pane-1', 'Pane title override')
    await (manager as unknown as { configWriteLock: Promise<void> }).configWriteLock

    expect(paneState.name).toBe('Pane title override')
    expect(configManager.loadWorkspaceConfig()?.panes[0]).toEqual({
      ...paneConfig,
      name: 'Pane title override',
    })
  })
})
