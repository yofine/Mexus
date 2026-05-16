import type { ReplayKind, ReplayPriority } from '../../core/types'

export interface MexusReplayPriorityOptions {
  paneId: string
  activePaneId?: string | null
  kind: ReplayKind
}

export function mapMexusReplayPriority(options: MexusReplayPriorityOptions): ReplayPriority {
  const isActivePane = options.activePaneId === options.paneId

  if (options.kind === 'head' && isActivePane) {
    return 'critical'
  }

  if (options.kind === 'head') {
    return 'normal'
  }

  return isActivePane ? 'normal' : 'background'
}
