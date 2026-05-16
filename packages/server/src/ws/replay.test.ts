import { describe, expect, it } from 'vitest'
import { buildTerminalReplayEvents, SCROLLBACK_REPLAY_CHUNK_SIZE, SCROLLBACK_REPLAY_MAX_BYTES } from './replay.ts'

describe('buildTerminalReplayEvents', () => {
  it('wraps scrollback chunks in explicit replay lifecycle events', () => {
    expect(buildTerminalReplayEvents('pane-1', 'abcdef', 2)).toEqual([
      { type: 'terminal.replay.start', paneId: 'pane-1', bytes: 6 },
      { type: 'terminal.replay.chunk', paneId: 'pane-1', data: 'ab', seq: 0 },
      { type: 'terminal.replay.chunk', paneId: 'pane-1', data: 'cd', seq: 1 },
      { type: 'terminal.replay.chunk', paneId: 'pane-1', data: 'ef', seq: 2 },
      { type: 'terminal.replay.end', paneId: 'pane-1', chunks: 3 },
    ])
  })

  it('does not emit replay events for empty scrollback', () => {
    expect(buildTerminalReplayEvents('pane-1', '', 2)).toEqual([])
  })

  it('uses small default chunks so live terminal traffic is not blocked behind replay', () => {
    expect(SCROLLBACK_REPLAY_CHUNK_SIZE).toBeLessThanOrEqual(64 * 1024)
  })

  it('only emits the most recent scrollback when over the replay budget', () => {
    expect(buildTerminalReplayEvents('pane-1', 'abcdef', 2, 4)).toEqual([
      { type: 'terminal.replay.start', paneId: 'pane-1', bytes: 4 },
      { type: 'terminal.replay.chunk', paneId: 'pane-1', data: 'cd', seq: 0 },
      { type: 'terminal.replay.chunk', paneId: 'pane-1', data: 'ef', seq: 1 },
      { type: 'terminal.replay.end', paneId: 'pane-1', chunks: 2 },
    ])
  })

  it('keeps initial reconnect replay bounded below the pty scrollback limit', () => {
    expect(SCROLLBACK_REPLAY_MAX_BYTES).toBeLessThanOrEqual(128 * 1024)
  })
})
