import { describe, expect, it } from 'vitest'
import { createTokenStore } from './tokenStore.ts'

describe('tokenStore', () => {
  it('issues unique tokens per pane', () => {
    const store = createTokenStore()
    const a = store.issue('pane-1')
    const b = store.issue('pane-2')
    expect(a).not.toEqual(b)
    expect(a).toMatch(/^[0-9a-f]{48}$/)
  })

  it('consume succeeds exactly once', () => {
    const store = createTokenStore()
    const t = store.issue('pane-1')
    expect(store.consume('pane-1', t)).toBe(true)
    expect(store.consume('pane-1', t)).toBe(false)
  })

  it('consume rejects wrong token', () => {
    const store = createTokenStore()
    store.issue('pane-1')
    expect(store.consume('pane-1', 'not-the-token')).toBe(false)
  })

  it('consume rejects cross-pane reuse', () => {
    const store = createTokenStore()
    const a = store.issue('pane-1')
    store.issue('pane-2')
    expect(store.consume('pane-2', a)).toBe(false)
    // pane-1's token must still be valid after the cross-pane attempt
    expect(store.consume('pane-1', a)).toBe(true)
  })

  it('reissue replaces the previous token for the same pane', () => {
    const store = createTokenStore()
    const a = store.issue('pane-1')
    const b = store.issue('pane-1')
    expect(a).not.toEqual(b)
    expect(store.consume('pane-1', a)).toBe(false)
    expect(store.consume('pane-1', b)).toBe(true)
  })

  it('clear removes an unused token', () => {
    const store = createTokenStore()
    const t = store.issue('pane-1')
    store.clear('pane-1')
    expect(store.consume('pane-1', t)).toBe(false)
    expect(store.size()).toBe(0)
  })
})
