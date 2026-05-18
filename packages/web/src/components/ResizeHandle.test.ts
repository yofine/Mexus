import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('ResizeHandle interactions', () => {
  it('does not bind click or double-click width cycling handlers', () => {
    const source = readFileSync(new URL('./ResizeHandle.tsx', import.meta.url), 'utf8')

    expect(source).not.toContain('onCycleWidth')
    expect(source).not.toContain('onResetWidth')
    expect(source).not.toContain('onClick=')
    expect(source).not.toContain('onDoubleClick=')
  })
})
