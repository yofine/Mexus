import type { TerminalViewport } from './types'

export function isSnapshotViewportCompatible(
  snapshot: TerminalViewport,
  current: TerminalViewport,
  maxColsDeltaRatio = 0.15,
): boolean {
  if (snapshot.cols === current.cols) {
    return true
  }

  if (snapshot.cols <= 0 || current.cols <= 0) {
    return false
  }

  const deltaRatio = Math.abs(snapshot.cols - current.cols) / snapshot.cols
  return deltaRatio <= maxColsDeltaRatio
}
