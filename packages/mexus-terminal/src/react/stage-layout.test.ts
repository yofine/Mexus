import { describe, expect, it } from 'vitest'

import { getTerminalStageLayerStyle } from './stage-layout'

describe('getTerminalStageLayerStyle', () => {
  it('keeps inactive terminal layers mounted at full stage size but not interactive', () => {
    expect(getTerminalStageLayerStyle(false)).toMatchObject({
      position: 'absolute',
      inset: 0,
      opacity: 0,
      pointerEvents: 'none',
      visibility: 'visible',
    })
  })

  it('puts the active terminal layer on top and makes it interactive', () => {
    expect(getTerminalStageLayerStyle(true)).toMatchObject({
      opacity: 1,
      pointerEvents: 'auto',
      zIndex: 2,
    })
  })

})
