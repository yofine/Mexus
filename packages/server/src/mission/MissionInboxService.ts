import fs from 'node:fs'
import path from 'node:path'
import type { InboxEvent, InboxState } from './inboxTypes.ts'

function emptyState(): InboxState {
  return { deduped: [], pending: [] }
}

function isInboxEvent(value: unknown): value is InboxEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<InboxEvent>
  return typeof event.id === 'string'
    && typeof event.kind === 'string'
    && typeof event.agentName === 'string'
    && typeof event.ref === 'string'
    && typeof event.createdAt === 'string'
}

function parseState(raw: string): InboxState {
  const parsed = JSON.parse(raw) as Partial<InboxState>
  return {
    deduped: Array.isArray(parsed.deduped)
      ? parsed.deduped.filter((key): key is string => typeof key === 'string')
      : [],
    pending: Array.isArray(parsed.pending)
      ? parsed.pending.filter(isInboxEvent)
      : [],
  }
}

export class MissionInboxService {
  private deduped = new Set<string>()
  private pending: InboxEvent[] = []
  private listeners = new Set<(event: InboxEvent) => void>()

  constructor(private readonly stateFilePath: string) {
    const state = this.load()
    this.deduped = new Set(state.deduped)
    this.pending = state.pending
  }

  enqueue(event: InboxEvent): boolean {
    if (this.deduped.has(event.id)) return false

    this.deduped.add(event.id)
    this.pending.push(event)
    this.flush()

    for (const listener of this.listeners) listener(event)
    return true
  }

  consume(): InboxEvent[] {
    return [...this.pending]
  }

  getPending(agentName: string): InboxEvent[] {
    return this.pending.filter((event) => event.agentName === agentName)
  }

  markDelivered(eventId: string): void {
    const next = this.pending.filter((event) => event.id !== eventId)
    if (next.length === this.pending.length) return
    this.pending = next
    this.flush()
  }

  onEnqueue(listener: (event: InboxEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  flush(): void {
    fs.mkdirSync(path.dirname(this.stateFilePath), { recursive: true })
    fs.writeFileSync(this.stateFilePath, JSON.stringify({
      deduped: [...this.deduped],
      pending: this.pending,
    }, null, 2))
  }

  private load(): InboxState {
    try {
      return parseState(fs.readFileSync(this.stateFilePath, 'utf-8'))
    } catch {
      return emptyState()
    }
  }
}
