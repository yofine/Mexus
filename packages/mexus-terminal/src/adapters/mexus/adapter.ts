import type {
  ReplayKind,
  ReplayTask,
  ReplayTaskHandle,
  TuiTerminalRuntime,
  TuiTerminalSession,
} from '../../core/types'
import { buildMexusTerminalCacheKey } from './cache-key'
import { mapMexusReplayPriority } from './event-mapper'
import type {
  MexusTerminalReplayChunkEvent,
  MexusTerminalReplayEndEvent,
  MexusTerminalReplayStartEvent,
  MexusTerminalServerEvent,
} from './types'

export interface CreateMexusTerminalAdapterOptions {
  runtime: TuiTerminalRuntime
  workspaceKey: string
  activePaneId?: string | null
  defaultCols?: number
}

interface PendingReplay {
  id: string
  paneId: string
  sessionKey?: string | null
  cols: number
  kind: ReplayKind
  chunks: string[]
}

export class MexusTerminalAdapter {
  private readonly runtime: TuiTerminalRuntime
  private readonly workspaceKey: string
  private readonly defaultCols: number
  private readonly knownPaneIds = new Set<string>()
  private readonly pendingReplays = new Map<string, PendingReplay>()
  private readonly replayHandles = new Map<string, ReplayTaskHandle>()
  private activePaneId?: string | null

  constructor(options: CreateMexusTerminalAdapterOptions) {
    this.runtime = options.runtime
    this.workspaceKey = options.workspaceKey
    this.activePaneId = options.activePaneId ?? null
    this.defaultCols = options.defaultCols ?? 120
  }

  handleEvent(event: MexusTerminalServerEvent): void {
    switch (event.type) {
      case 'terminal.output':
        this.getOrCreateSession(event.paneId, event.sessionKey, event.cols).writeLive(event.data)
        return
      case 'terminal.replay.start':
        this.startReplay(event)
        return
      case 'terminal.replay.chunk':
        this.appendReplayChunk(event)
        return
      case 'terminal.replay.end':
        this.endReplay(event)
        return
    }
  }

  setActivePane(paneId: string | null): void {
    this.activePaneId = paneId
  }

  resetWorkspace(): void {
    for (const handle of this.replayHandles.values()) {
      handle.cancel()
    }
    this.replayHandles.clear()
    this.pendingReplays.clear()

    for (const paneId of this.knownPaneIds) {
      this.runtime.getTerminal(paneId)?.cancelAllReplay()
      this.runtime.disposeTerminal(paneId)
    }
    this.knownPaneIds.clear()
  }

  disposePane(paneId: string): void {
    this.pendingReplays.delete(this.getReplayId(paneId))
    for (const [replayId, handle] of this.replayHandles) {
      if (replayId === this.getReplayId(paneId) || replayId.startsWith(`${paneId}:`)) {
        handle.cancel()
        this.replayHandles.delete(replayId)
      }
    }
    this.runtime.getTerminal(paneId)?.cancelAllReplay()
    this.runtime.disposeTerminal(paneId)
    this.knownPaneIds.delete(paneId)
  }

  private startReplay(event: MexusTerminalReplayStartEvent): void {
    const replayId = this.getReplayId(event.paneId, event.replayId)
    this.pendingReplays.set(replayId, {
      id: replayId,
      paneId: event.paneId,
      sessionKey: event.sessionKey,
      cols: this.normalizeCols(event.cols),
      kind: event.kind ?? 'history',
      chunks: [],
    })
    this.getOrCreateSession(event.paneId, event.sessionKey, event.cols)
  }

  private appendReplayChunk(event: MexusTerminalReplayChunkEvent): void {
    const pending = this.pendingReplays.get(this.getReplayId(event.paneId, event.replayId))
    if (!pending) {
      return
    }
    pending.chunks.push(event.data)
  }

  private endReplay(event: MexusTerminalReplayEndEvent): void {
    const replayId = this.getReplayId(event.paneId, event.replayId)
    const pending = this.pendingReplays.get(replayId)
    if (!pending) {
      return
    }
    this.pendingReplays.delete(replayId)

    const session = this.getOrCreateSession(pending.paneId, pending.sessionKey, pending.cols)
    const task: ReplayTask = {
      id: pending.id,
      kind: pending.kind,
      priority: mapMexusReplayPriority({
        paneId: pending.paneId,
        activePaneId: this.activePaneId,
        kind: pending.kind,
      }),
      source: pending.chunks,
      interruptible: false,
      resetBeforeWrite: true,
    }
    this.replayHandles.set(task.id, session.enqueueReplay(task))
  }

  private getOrCreateSession(
    paneId: string,
    sessionKey?: string | null,
    cols?: number | null,
  ): TuiTerminalSession {
    this.knownPaneIds.add(paneId)
    const existing = this.runtime.getTerminal(paneId)
    if (existing) {
      return existing
    }

    return this.runtime.createTerminal({
      id: paneId,
      cacheKey: buildMexusTerminalCacheKey({
        workspaceKey: this.workspaceKey,
        paneId,
        sessionKey,
        cols: this.normalizeCols(cols),
      }),
    })
  }

  private normalizeCols(cols?: number | null): number {
    return typeof cols === 'number' && Number.isFinite(cols) && cols > 0
      ? Math.floor(cols)
      : this.defaultCols
  }

  private getReplayId(paneId: string, replayId?: string): string {
    return replayId ?? `${paneId}:replay`
  }
}

export function createMexusTerminalAdapter(
  options: CreateMexusTerminalAdapterOptions,
): MexusTerminalAdapter {
  return new MexusTerminalAdapter(options)
}
