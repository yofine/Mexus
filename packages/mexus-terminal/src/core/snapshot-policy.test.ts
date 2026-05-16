import { describe, expect, it } from 'vitest'

import { isSnapshotViewportCompatible } from './snapshot-policy'

describe('isSnapshotViewportCompatible', () => {
  it('accepts identical columns', () => {
    expect(
      isSnapshotViewportCompatible(
        { cols: 120, rows: 24 },
        { cols: 120, rows: 40 },
      ),
    ).toBe(true)
  })

  it('accepts column differences within the max ratio', () => {
    expect(
      isSnapshotViewportCompatible(
        { cols: 100, rows: 24 },
        { cols: 115, rows: 24 },
      ),
    ).toBe(true)
  })

  it('rejects column differences above the max ratio', () => {
    expect(
      isSnapshotViewportCompatible(
        { cols: 100, rows: 24 },
        { cols: 116, rows: 24 },
      ),
    ).toBe(false)
  })

  it('does not reject based on row differences alone', () => {
    expect(
      isSnapshotViewportCompatible(
        { cols: 100, rows: 10 },
        { cols: 100, rows: 80 },
      ),
    ).toBe(true)
  })

  it('uses a custom max column delta ratio', () => {
    expect(
      isSnapshotViewportCompatible(
        { cols: 100, rows: 24 },
        { cols: 111, rows: 24 },
        0.1,
      ),
    ).toBe(false)
  })
})
