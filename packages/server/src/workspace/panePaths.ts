import path from 'node:path'
import type { PaneConfig } from '../types.ts'

export function resolvePaneBasePath(projectDir: string, config: PaneConfig): string {
  return (config.isolation === 'worktree' && config.worktreePath)
    ? config.worktreePath
    : projectDir
}

export function resolvePaneCwd(projectDir: string, config: PaneConfig): string {
  return path.resolve(resolvePaneBasePath(projectDir, config))
}
