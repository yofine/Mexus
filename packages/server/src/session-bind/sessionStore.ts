// In-memory record of pane → sessionId bindings received from agent plugins.
//
// Sidecar-only: this is intentionally NOT wired to .nexus/config.yaml yet.
// Once the sidecar is validated end-to-end we'll add a single adapter that
// forwards records into WorkspaceManager.updatePaneConfigSessionId, replacing
// the current statusline-based path.

export interface SessionRecord {
  paneId: string
  sessionId: string
  agent: string
  source: string
  receivedAt: number
}

export interface SessionStore {
  set(record: SessionRecord): void
  get(paneId: string): SessionRecord | undefined
  list(): SessionRecord[]
  clear(paneId?: string): void
}

export function createSessionStore(): SessionStore {
  const records = new Map<string, SessionRecord>()

  return {
    set(record) {
      records.set(record.paneId, record)
    },
    get(paneId) {
      return records.get(paneId)
    },
    list() {
      return Array.from(records.values())
    },
    clear(paneId) {
      if (paneId === undefined) records.clear()
      else records.delete(paneId)
    },
  }
}
