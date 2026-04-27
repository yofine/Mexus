import { describe, expect, it } from 'vitest'
import type { PaneConfig } from '../types.ts'
import { resolvePaneCwd } from './panePaths.ts'

const baseConfig: PaneConfig = {
  id: 'pane-1',
  name: 'Worker',
  agent: 'claudecode',
  restore: 'restart',
  isolation: 'shared',
  yolo: false,
}

describe('resolvePaneCwd', () => {
  it('keeps shared panes at the project root even when workdir is set', () => {
    expect(resolvePaneCwd('/repo/app', { ...baseConfig, workdir: 'src/auth' }))
      .toBe('/repo/app')
  })

  it('keeps worktree panes at the worktree root even when workdir is set', () => {
    expect(resolvePaneCwd('/repo/app', {
      ...baseConfig,
      isolation: 'worktree',
      worktreePath: '/repo/.worktrees/pane-1',
      workdir: 'src/auth',
    })).toBe('/repo/.worktrees/pane-1')
  })
})
