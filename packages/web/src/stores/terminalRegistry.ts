/**
 * Global terminal write callback registry.
 * Avoids React rendering overhead for high-frequency terminal output.
 * Keeps a scrollback history so re-mounted terminals can replay output.
 *
 * Also stores xterm + FitAddon references for external control:
 * - pause/resume writes (to avoid zero-size rendering while collapsed)
 * - scrollToBottom (to jump to latest output when expanding)
 * - refit (to recalculate dimensions after visibility change)
 *
 * Writes are batched per animation frame to avoid blocking the main thread
 * when PTY output arrives in many small chunks (common on WSL2 / high-throughput).
 */
import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'

const writers = new Map<string, (data: string) => void>()
const histories = new Map<string, string[]>()
const terminals = new Map<string, Terminal>()
const fitAddons = new Map<string, FitAddon>()
const paused = new Set<string>()
const activeReplays = new Set<string>()
const pausedBacklogs = new Map<string, string[]>()
const pausedBacklogBytes = new Map<string, number>()

const MAX_HISTORY_CHUNKS = 10000
const MAX_HISTORY_BYTES = 5 * 1024 * 1024 // 5 MB per pane
const MAX_PAUSED_BACKLOG_BYTES = 128 * 1024 // first-screen catch-up without rendering hidden panes forever
const historyBytes = new Map<string, number>()

// ─── Write Batching ─────────────────────────────────────────
// Accumulate chunks per pane and flush once per animation frame.
// This turns N synchronous term.write() calls into 1 per frame,
// dramatically reducing xterm rendering overhead.

const pendingWrites = new Map<string, string[]>()
let rafScheduled = false

function scheduleFlush(): void {
  if (!rafScheduled) {
    rafScheduled = true
    requestAnimationFrame(flushWrites)
  }
}

function appendHistory(paneId: string, data: string): void {
  let history = histories.get(paneId)
  if (!history) {
    history = []
    histories.set(paneId, history)
  }
  history.push(data)
  const bytes = (historyBytes.get(paneId) || 0) + data.length
  historyBytes.set(paneId, bytes)

  // Trim to avoid unbounded memory growth — by chunk count AND byte size
  if (history.length > MAX_HISTORY_CHUNKS || bytes > MAX_HISTORY_BYTES) {
    const removeCount = Math.max(1, Math.floor(history.length / 4))
    let removedBytes = 0
    for (let i = 0; i < removeCount; i++) {
      removedBytes += history[i].length
    }
    history.splice(0, removeCount)
    historyBytes.set(paneId, bytes - removedBytes)
  }
}

function enqueueTerminalWrite(paneId: string, data: string): void {
  if (paused.has(paneId)) {
    let backlog = pausedBacklogs.get(paneId)
    if (!backlog) {
      backlog = []
      pausedBacklogs.set(paneId, backlog)
    }
    backlog.push(data)

    let bytes = (pausedBacklogBytes.get(paneId) || 0) + data.length
    pausedBacklogBytes.set(paneId, bytes)

    while (bytes > MAX_PAUSED_BACKLOG_BYTES && backlog.length > 1) {
      const removed = backlog.shift()
      bytes -= removed?.length || 0
      pausedBacklogBytes.set(paneId, bytes)
    }
    return
  }

  // Batch writes — accumulate and flush on next animation frame
  let pending = pendingWrites.get(paneId)
  if (!pending) {
    pending = []
    pendingWrites.set(paneId, pending)
  }
  pending.push(data)
  scheduleFlush()
}

function flushWrites(): void {
  rafScheduled = false
  for (const [paneId, chunks] of pendingWrites) {
    if (paused.has(paneId)) continue
    const writer = writers.get(paneId)
    if (writer && chunks.length > 0) {
      writer(chunks.join(''))
    }
  }
  pendingWrites.clear()
}

// ─── Public API ─────────────────────────────────────────────

export function registerTerminalWriter(
  paneId: string,
  writeFn: (data: string) => void,
  term: Terminal,
  fitAddon: FitAddon,
): void {
  writers.set(paneId, writeFn)
  terminals.set(paneId, term)
  fitAddons.set(paneId, fitAddon)

  // Replay history into newly mounted terminal (only if not paused)
  if (!paused.has(paneId)) {
    const history = histories.get(paneId)
    if (history && history.length > 0) {
      writeFn(history.join(''))
    }
  }
}

export function unregisterTerminalWriter(paneId: string): void {
  writers.delete(paneId)
  terminals.delete(paneId)
  fitAddons.delete(paneId)
  pendingWrites.delete(paneId)
  paused.delete(paneId)
  activeReplays.delete(paneId)
  pausedBacklogs.delete(paneId)
  pausedBacklogBytes.delete(paneId)
  // Note: don't delete history here — pane may re-mount (collapse/expand)
}

export function writeToTerminal(paneId: string, data: string): void {
  if (activeReplays.has(paneId)) {
    activeReplays.delete(paneId)
    pendingWrites.delete(paneId)
    histories.set(paneId, [data])
    historyBytes.set(paneId, data.length)
    pausedBacklogs.set(paneId, [data])
    pausedBacklogBytes.set(paneId, data.length)
    const writer = writers.get(paneId)
    if (writer && !paused.has(paneId)) {
      pausedBacklogs.delete(paneId)
      pausedBacklogBytes.delete(paneId)
      writer(data)
    }
    return
  }

  appendHistory(paneId, data)
  enqueueTerminalWrite(paneId, data)
}

export function writeReplayToTerminal(paneId: string, data: string): void {
  if (!activeReplays.has(paneId)) return
  appendHistory(paneId, data)
  enqueueTerminalWrite(paneId, data)
}

export function finishTerminalReplay(paneId: string): void {
  activeReplays.delete(paneId)
}

export function clearTerminalHistory(paneId: string): void {
  histories.delete(paneId)
  historyBytes.delete(paneId)
  pendingWrites.delete(paneId)
  if (pendingWrites.size === 0) rafScheduled = false
  paused.delete(paneId)
  activeReplays.delete(paneId)
  pausedBacklogs.delete(paneId)
  pausedBacklogBytes.delete(paneId)
}

export function resetTerminalForReplay(paneId: string): void {
  clearTerminalHistory(paneId)
  activeReplays.add(paneId)
  const term = terminals.get(paneId)
  if (term) {
    term.reset()
    term.clear()
  }
}

/**
 * Clear ALL histories and pending writes. Called on WebSocket reconnect
 * to avoid duplicate scrollback when the server replays full history.
 */
export function clearAllHistories(): void {
  histories.clear()
  historyBytes.clear()
  pendingWrites.clear()
  rafScheduled = false
  paused.clear()
  activeReplays.clear()
  pausedBacklogs.clear()
  pausedBacklogBytes.clear()
}

// ─── Pause / Resume ──────────────────────────────────────────
// Pause is kept for legacy callers and emergency zero-size protection.
// TUI agents should prefer keeping xterm mounted at a non-zero hidden size,
// because reset + replay is not reliable for full-screen cursor control output.

export function pauseTerminal(paneId: string): void {
  paused.add(paneId)
  pendingWrites.delete(paneId)
}

export function unpauseTerminal(paneId: string): void {
  paused.delete(paneId)
  const backlog = pausedBacklogs.get(paneId)
  if (!backlog || backlog.length === 0) return

  pausedBacklogs.delete(paneId)
  pausedBacklogBytes.delete(paneId)
  const writer = writers.get(paneId)
  if (writer) {
    writer(backlog.join(''))
  }
}

export function resumeTerminal(paneId: string): void {
  paused.delete(paneId)
  // Reset xterm buffer and replay history with correct dimensions
  const term = terminals.get(paneId)
  const writer = writers.get(paneId)
  if (term) {
    term.reset()
    const history = histories.get(paneId)
    if (writer && history && history.length > 0) {
      // Join all history into a single write to minimize rendering passes
      writer(history.join(''))
    }
  }
}

// ─── External Control ────────────────────────────────────────

export function scrollTerminalToBottom(paneId: string): void {
  const term = terminals.get(paneId)
  if (term) {
    term.scrollToBottom()
  }
}

export function refitTerminal(paneId: string): void {
  const fitAddon = fitAddons.get(paneId)
  const term = terminals.get(paneId)
  if (fitAddon) {
    try {
      fitAddon.fit()
      if (term) {
        term.refresh(0, Math.max(0, term.rows - 1))
      }
    } catch {
      // fitAddon.fit() can throw if the terminal is not attached
    }
  }
}

export function getTerminalDimensions(paneId: string): { cols: number; rows: number } | null {
  const term = terminals.get(paneId)
  if (term) {
    return { cols: term.cols, rows: term.rows }
  }
  return null
}
