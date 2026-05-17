import { describe, expect, it } from 'vitest'
import { formatStartupMessage } from './index.ts'

describe('server startup output', () => {
  it('prints the concise public URL for successful starts', () => {
    expect(formatStartupMessage(7788)).toBe('Mexus running on http://localhost:7788')
  })
})
