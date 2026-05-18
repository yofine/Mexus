import type { CSSProperties } from 'react'

export function getTerminalStageLayerStyle(active: boolean): CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    minWidth: 0,
    minHeight: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    opacity: active ? 1 : 0,
    pointerEvents: active ? 'auto' : 'none',
    visibility: 'visible',
    zIndex: active ? 2 : 1,
  }
}

export function getTerminalStageRootStyle(): CSSProperties {
  return {
    position: 'relative',
    width: '100%',
    height: '100%',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  }
}
