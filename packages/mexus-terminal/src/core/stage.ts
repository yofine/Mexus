import type {
  TerminalId,
  TuiTerminalRuntime,
  TuiTerminalSession,
} from './types'

export interface TerminalStageSnapshot {
  sessionIds: TerminalId[]
  activeSessionId: TerminalId | null
}

export class TerminalStageController {
  private readonly runtime: TuiTerminalRuntime
  private readonly sessions = new Map<TerminalId, TuiTerminalSession>()
  private activeSessionId: TerminalId | null = null

  constructor(runtime: TuiTerminalRuntime) {
    this.runtime = runtime
  }

  setSessions(sessionIds: TerminalId[]): void {
    const nextIds = new Set(sessionIds)

    for (const id of [...this.sessions.keys()]) {
      if (!nextIds.has(id)) {
        this.sessions.get(id)?.dispose()
        this.sessions.delete(id)
        this.runtime.disposeTerminal(id)
      }
    }

    for (const id of sessionIds) {
      if (this.sessions.has(id)) continue

      const session = this.runtime.getTerminal(id) ?? this.runtime.createTerminal({ id })
      session.setVisibility('visible')
      this.sessions.set(id, session)
    }

    if (this.activeSessionId && !nextIds.has(this.activeSessionId)) {
      this.activeSessionId = null
    }
  }

  setActiveSession(sessionId: TerminalId | null): void {
    this.activeSessionId = sessionId && this.sessions.has(sessionId) ? sessionId : null

    for (const session of this.sessions.values()) {
      session.setVisibility('visible')
    }
  }

  getActiveSessionId(): TerminalId | null {
    return this.activeSessionId
  }

  getSession(sessionId: TerminalId): TuiTerminalSession | undefined {
    return this.sessions.get(sessionId)
  }

  writeLive(sessionId: TerminalId, data: string): void {
    this.sessions.get(sessionId)?.writeLive(data)
  }

  snapshot(): TerminalStageSnapshot {
    return {
      sessionIds: [...this.sessions.keys()],
      activeSessionId: this.activeSessionId,
    }
  }

  dispose(): void {
    for (const id of [...this.sessions.keys()]) {
      this.sessions.get(id)?.dispose()
      this.runtime.disposeTerminal(id)
    }
    this.sessions.clear()
    this.activeSessionId = null
  }
}
