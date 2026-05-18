import type { ServerEvent } from '../types.ts'

export const SCROLLBACK_REPLAY_CHUNK_SIZE = 64 * 1024
export const SCROLLBACK_REPLAY_MAX_BYTES = 128 * 1024

export function buildTerminalReplayEvents(
  paneId: string,
  scrollback: string,
  chunkSize = SCROLLBACK_REPLAY_CHUNK_SIZE,
  maxBytes = SCROLLBACK_REPLAY_MAX_BYTES,
): ServerEvent[] {
  if (!scrollback) return []

  const replayId = `${paneId}:history`
  const replayScrollback = maxBytes > 0 && scrollback.length > maxBytes
    ? scrollback.slice(-maxBytes)
    : scrollback

  const events: ServerEvent[] = [
    { type: 'terminal.replay.start', paneId, bytes: replayScrollback.length, kind: 'history', replayId },
  ]
  let chunks = 0
  for (let i = 0; i < replayScrollback.length; i += chunkSize) {
    events.push({
      type: 'terminal.replay.chunk',
      paneId,
      data: replayScrollback.slice(i, i + chunkSize),
      seq: chunks,
      kind: 'history',
      replayId,
    })
    chunks += 1
  }
  events.push({ type: 'terminal.replay.end', paneId, chunks, kind: 'history', replayId })
  return events
}
