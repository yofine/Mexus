import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import watcher, { type AsyncSubscription } from '@parcel/watcher'
import type { MissionInboxService } from './MissionInboxService.ts'
import type {
  MissionRoundtableParseResult,
  RoundtableItem,
  RoundtableVoteState,
} from './missionParsers.ts'

export type MissionRoundtableParser = (markdown: string) => MissionRoundtableParseResult

interface ItemSnapshot {
  voteSnapshot: string
  decision?: string
  votes: Map<string, RoundtableVoteState>
}

interface MissionRoundtableWatcherOptions {
  debounceMs?: number
  now?: () => Date
}

export class MissionRoundtableWatcher {
  private readonly roundtablePath: string
  private readonly debounceMs: number
  private readonly now: () => Date
  private subscription: AsyncSubscription | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private prevItems: Map<string, ItemSnapshot> | null = null

  constructor(
    missionPath: string,
    private readonly parser: MissionRoundtableParser,
    private readonly inboxService: MissionInboxService,
    private readonly agentRoster: () => string[],
    options: MissionRoundtableWatcherOptions = {},
  ) {
    this.roundtablePath = path.join(missionPath, 'roundtable.md')
    this.debounceMs = options.debounceMs ?? 500
    this.now = options.now ?? (() => new Date())
  }

  async start(): Promise<void> {
    this.readAndDiff()
    this.subscription = await watcher.subscribe(
      path.dirname(this.roundtablePath),
      (err, events) => {
        if (err) return
        if (!events.some((event) => path.resolve(event.path) === path.resolve(this.roundtablePath))) return
        this.scheduleRead()
      },
    )
  }

  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    await Promise.resolve(this.subscription?.unsubscribe()).catch(() => {})
    this.subscription = null
  }

  private scheduleRead(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.readAndDiff()
    }, this.debounceMs)
  }

  private readAndDiff(): void {
    let raw: string
    try {
      raw = fs.readFileSync(this.roundtablePath, 'utf-8')
    } catch {
      raw = ''
    }

    const parsed = this.parser(raw)
    if (!parsed.ok) return

    const current = new Map<string, ItemSnapshot>()
    for (const item of parsed.items) {
      const snapshot = snapshotItem(item)
      current.set(item.ref, snapshot)

      if (this.prevItems === null) continue
      this.emitDiff(item, snapshot, this.prevItems.get(item.ref))
    }

    this.prevItems = current
  }

  private emitDiff(item: RoundtableItem, snapshot: ItemSnapshot, previous?: ItemSnapshot): void {
    if (item.section !== 'Pending Review') return

    const createdAt = this.now().toISOString()
    const snapshotKey = `${item.ref}:${snapshot.voteSnapshot}:${snapshot.decision ?? ''}`

    for (const agentName of this.pendingInvitees(item)) {
      this.inboxService.enqueue({
        id: `${snapshotKey}:roundtable-vote:${agentName}`,
        kind: 'roundtable-vote',
        agentName,
        ref: item.ref,
        topic: item.topic,
        createdAt,
      })
    }

    for (const [agentName, vote] of snapshot.votes) {
      const previousVote = previous?.votes.get(agentName)
      if (vote === 'pending') continue
      if (previousVote !== undefined && previousVote !== 'pending') continue
      this.inboxService.enqueue({
        id: `${snapshotKey}:roundtable-progress:${agentName}`,
        kind: 'roundtable-progress',
        agentName: item.openedBy,
        ref: item.ref,
        topic: item.topic,
        createdAt,
      })
    }
  }

  private pendingInvitees(item: RoundtableItem): string[] {
    const voteByAgent = new Map(item.votes.map((vote) => [vote.agent, vote.vote]))
    const invitees = item.invitees.includes('All')
      ? safeRoster(this.agentRoster)
      : item.invitees
    return invitees
      .filter((agentName) => voteByAgent.get(agentName) === 'pending')
      .filter(unique)
  }
}

function snapshotItem(item: RoundtableItem): ItemSnapshot {
  const sortedVotes = [...item.votes].sort((a, b) => a.agent.localeCompare(b.agent))
  const voteSnapshot = sortedVotes.map((vote) => `${vote.agent}:${vote.vote}`).join('|')
  return {
    voteSnapshot: shortHash(voteSnapshot),
    decision: item.decision,
    votes: new Map(sortedVotes.map((vote) => [vote.agent, vote.vote])),
  }
}

function safeRoster(agentRoster: () => string[]): string[] {
  try {
    return agentRoster()
  } catch {
    return []
  }
}

function unique(value: string, index: number, array: string[]): boolean {
  return array.indexOf(value) === index
}

function shortHash(value: string): string {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 8)
}
