import { describe, expect, it } from 'vitest'
import { createSessionStore, type SessionRecord } from './sessionStore.ts'

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    paneId: 'pane-1',
    sessionId: 'sess-abc',
    agent: 'claudecode',
    source: 'startup',
    receivedAt: 1_700_000_000_000,
    ...overrides,
  }
}

describe('sessionStore', () => {
  it('set + get round-trips a record', () => {
    const store = createSessionStore()
    const record = makeRecord()
    store.set(record)
    expect(store.get('pane-1')).toEqual(record)
  })

  it('get returns undefined for unknown panes', () => {
    const store = createSessionStore()
    expect(store.get('missing')).toBeUndefined()
  })

  it('set overwrites the previous binding (resume case)', () => {
    const store = createSessionStore()
    store.set(makeRecord({ sessionId: 'sess-old', source: 'startup' }))
    store.set(makeRecord({ sessionId: 'sess-new', source: 'resume' }))
    expect(store.get('pane-1')).toEqual(
      expect.objectContaining({ sessionId: 'sess-new', source: 'resume' }),
    )
  })

  it('list returns every record', () => {
    const store = createSessionStore()
    store.set(makeRecord({ paneId: 'pane-1' }))
    store.set(makeRecord({ paneId: 'pane-2', sessionId: 'sess-2' }))
    expect(store.list().map((r) => r.paneId).sort()).toEqual(['pane-1', 'pane-2'])
  })

  it('clear(paneId) removes only that record', () => {
    const store = createSessionStore()
    store.set(makeRecord({ paneId: 'pane-1' }))
    store.set(makeRecord({ paneId: 'pane-2', sessionId: 'sess-2' }))
    store.clear('pane-1')
    expect(store.get('pane-1')).toBeUndefined()
    expect(store.get('pane-2')).toBeDefined()
  })

  it('clear() with no arg wipes everything', () => {
    const store = createSessionStore()
    store.set(makeRecord({ paneId: 'pane-1' }))
    store.set(makeRecord({ paneId: 'pane-2', sessionId: 'sess-2' }))
    store.clear()
    expect(store.list()).toEqual([])
  })
})
