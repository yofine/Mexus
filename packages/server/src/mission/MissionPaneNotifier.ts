import type { WorkspaceManager } from '../workspace/WorkspaceManager.ts'
import type { PaneState, PaneStatus } from '../types.ts'
import type { MissionInboxService } from './MissionInboxService.ts'
import type { InboxEvent } from './inboxTypes.ts'

interface MissionPaneNotifierOptions {
  ttlMs?: number
  now?: () => number
}

type WorkspaceLike = Pick<WorkspaceManager, 'getPanes' | 'writeToPane' | 'onEvents'> | {
  panes: PaneState[]
  writeToPane: (paneId: string, data: string) => void
  onEvents: WorkspaceManager['onEvents']
}

interface HeldEvent {
  eventId: string
  firstHeldAt: number
}

const DELIVERABLE_STATUSES = new Set<PaneStatus>(['waiting', 'idle'])
const HOLD_STATUSES = new Set<PaneStatus>(['stopped', 'error'])

export class MissionPaneNotifier {
  private readonly ttlMs: number
  private readonly now: () => number
  private stopInboxListener: (() => void) | null = null
  private stopPaneListener: (() => void) | null = null
  private held = new Map<string, HeldEvent>()

  constructor(
    private readonly workspaceManager: WorkspaceLike,
    private readonly inboxService: MissionInboxService,
    options: MissionPaneNotifierOptions = {},
  ) {
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000
    this.now = options.now ?? (() => Date.now())
  }

  start(): void {
    if (this.stopInboxListener) return
    this.stopInboxListener = this.inboxService.onEnqueue((event) => {
      this.flushAgent(event.agentName)
    })
    this.stopPaneListener = this.workspaceManager.onEvents({
      onPaneStatus: (paneId, status) => {
        if (DELIVERABLE_STATUSES.has(status)) this.flushPane(paneId)
      },
    })
  }

  stop(): void {
    this.stopInboxListener?.()
    this.stopPaneListener?.()
    this.stopInboxListener = null
    this.stopPaneListener = null
  }

  flushPane(paneId: string): void {
    const pane = this.getPanes().find((candidate) => candidate.id === paneId)
    if (!pane) return
    const agentName = pane.mission?.role === 'squad-lead' ? 'Squad Lead' : pane.mission?.agentName
    if (!agentName) return
    this.flushAgent(agentName)
  }

  private flushAgent(agentName: string): void {
    const pane = this.resolvePane(agentName)
    if (!pane) return

    const events = this.inboxService.getPending(agentName)
    if (events.length === 0) return

    if (HOLD_STATUSES.has(pane.status)) {
      this.expireOrHold(events)
      return
    }

    if (!DELIVERABLE_STATUSES.has(pane.status)) return

    const message = formatInboxMessage(events)
    try {
      this.workspaceManager.writeToPane(pane.id, message)
    } catch {
      return
    }

    for (const event of events) {
      this.held.delete(event.id)
      this.inboxService.markDelivered(event.id)
    }
  }

  private expireOrHold(events: InboxEvent[]): void {
    const now = this.now()
    for (const event of events) {
      const held = this.held.get(event.id)
      if (!held) {
        this.held.set(event.id, { eventId: event.id, firstHeldAt: now })
        continue
      }
      if (now - held.firstHeldAt >= this.ttlMs) {
        this.held.delete(event.id)
        this.inboxService.markDelivered(event.id)
      }
    }
  }

  private resolvePane(agentName: string): PaneState | undefined {
    const panes = this.getPanes()
      .map((pane, index) => ({ pane, index }))
      .filter(({ pane }) => {
        if (agentName === 'Squad Lead') return pane.mission?.role === 'squad-lead'
        return pane.mission?.agentName === agentName
      })
      .sort((a, b) => {
        const started = startedAtMs(a.pane) - startedAtMs(b.pane)
        return started || a.index - b.index
      })
    return panes[0]?.pane
  }

  private getPanes(): PaneState[] {
    if ('getPanes' in this.workspaceManager) return this.workspaceManager.getPanes()
    return this.workspaceManager.panes
  }
}

function startedAtMs(pane: PaneState): number {
  return pane.startedAt ? Date.parse(pane.startedAt) || Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER
}

function formatInboxMessage(events: InboxEvent[]): string {
  const counts = {
    tasks: events.filter((event) => event.kind === 'task-assigned').length,
    reviews: events.filter((event) => event.kind === 'review-pending').length,
    roundtable: events.filter((event) => event.kind === 'roundtable-vote' || event.kind === 'roundtable-progress').length,
    clarifications: events.filter((event) => event.kind === 'clarification').length,
  }
  const lines = [
    `\r\n[Mission Inbox] You have ${counts.tasks} new task(s), ${counts.reviews} review(s) pending, ${counts.roundtable} roundtable item(s), ${counts.clarifications} clarification(s).`,
    ...events.map(formatEvent),
    'Run your kanban / roundtable check workflow.',
  ]
  return `${lines.join('\r\n')}\r\n`
}

function formatEvent(event: InboxEvent): string {
  switch (event.kind) {
    case 'task-assigned':
      return `- Task assigned: ${event.ref} (Scope: ${event.scope ?? 'unknown'}) - see kanban.md "To Claim".`
    case 'review-pending':
      return `- Review pending: ${event.ref} moved to Done by ${event.doneByAgent ?? 'unknown'} - see kanban.md "Done".`
    case 'roundtable-vote':
    case 'roundtable-progress':
      return `- Roundtable vote: ${event.ref} (${event.topic ?? 'untitled'}) - see roundtable.md "Pending Review".`
    case 'clarification':
      return `- Clarification requested: ${event.ref} by ${event.requesterAgent ?? 'unknown'} - see kanban.md.`
  }
}
