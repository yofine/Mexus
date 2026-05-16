import type { MexusTerminalIdentity } from './types'

export function buildMexusTerminalCacheKey(options: MexusTerminalIdentity): string {
  return [
    'mexus',
    'v1',
    options.workspaceKey,
    options.paneId,
    options.sessionKey || 'none',
    String(options.cols),
  ].join(':')
}
