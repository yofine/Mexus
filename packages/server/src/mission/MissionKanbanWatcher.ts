import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import watcher, { type AsyncSubscription } from '@parcel/watcher'
import type { MissionInboxService } from './MissionInboxService.ts'
import type { InboxEvent } from './inboxTypes.ts'
import type {
  MissionKanbanParseResult,
  MissionKanbanTasks,
  MissionTask as MissionKanbanTask,
} from './missionParsers.ts'

export type MissionKanbanStatus = 'to-claim' | 'in-progress' | 'done'
export type { MissionKanbanParseResult, MissionKanbanTasks, MissionKanbanTask } from './missionParsers.ts'

export type MissionKanbanParser = (markdown: string) => MissionKanbanParseResult

interface TaskSnapshot {
  status: MissionKanbanStatus
  reviewFilled: boolean
  clarificationHash?: string
}

interface FlattenedTask {
  task: MissionKanbanTask
  status: MissionKanbanStatus
}

interface MissionKanbanWatcherOptions {
  debounceMs?: number
  now?: () => Date
}

export class MissionKanbanWatcher {
  private readonly kanbanPath: string
  private readonly debounceMs: number
  private readonly now: () => Date
  private subscription: AsyncSubscription | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private prevTasks: Map<string, TaskSnapshot> | null = null

  constructor(
    missionPath: string,
    private readonly parser: MissionKanbanParser,
    private readonly inboxService: MissionInboxService,
    options: MissionKanbanWatcherOptions = {},
  ) {
    this.kanbanPath = path.join(missionPath, 'kanban.md')
    this.debounceMs = options.debounceMs ?? 500
    this.now = options.now ?? (() => new Date())
  }

  async start(): Promise<void> {
    this.readAndDiff()
    this.subscription = await watcher.subscribe(
      path.dirname(this.kanbanPath),
      (err, events) => {
        if (err) return
        if (!events.some((event) => path.resolve(event.path) === path.resolve(this.kanbanPath))) return
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
      raw = fs.readFileSync(this.kanbanPath, 'utf-8')
    } catch {
      raw = ''
    }

    const parsed = this.parser(raw)
    if (!parsed.ok) return

    const current = new Map<string, TaskSnapshot>()
    const tasks = this.flatten(parsed.tasks)

    for (const { task, status } of tasks) {
      if (!task.ref) continue
      const reviewFilled = Boolean(task.review?.trim())
      const clarification = clarificationText(task)
      const clarificationHash = clarification ? shortHash(clarification) : undefined
      current.set(task.ref, { status, reviewFilled, clarificationHash })

      if (this.prevTasks === null) continue
      const previous = this.prevTasks.get(task.ref)
      this.emitDiff(task, status, reviewFilled, clarification, clarificationHash, previous)
    }

    this.prevTasks = current
  }

  private emitDiff(
    task: MissionKanbanTask,
    status: MissionKanbanStatus,
    reviewFilled: boolean,
    clarification: string | undefined,
    clarificationHash: string | undefined,
    previous?: TaskSnapshot,
  ): void {
    if (!task.ref) return

    const createdAt = this.now().toISOString()
    const taskTitle = firstLine(task.request) ?? task.ref

    if (clarification && clarificationHash && previous?.clarificationHash !== clarificationHash) {
      this.inboxService.enqueue({
        id: `${task.ref}:clarification:${clarificationHash}`,
        kind: 'clarification',
        agentName: 'Squad Lead',
        ref: task.ref,
        taskTitle,
        requesterAgent: task.to,
        createdAt,
      })
    }

    if (status === 'to-claim' && previous?.status !== 'to-claim') {
      this.inboxService.enqueue({
        id: `${task.ref}:${status}:${reviewFilled}`,
        kind: 'task-assigned',
        agentName: task.to,
        ref: task.ref,
        scope: task.scope,
        taskTitle,
        createdAt,
      })
      return
    }

    const becameUnreviewedDone = status === 'done'
      && !reviewFilled
      && (previous?.status !== 'done' || previous.reviewFilled)
    if (becameUnreviewedDone) {
      this.inboxService.enqueue({
        id: `${task.ref}:${status}:${reviewFilled}`,
        kind: 'review-pending',
        agentName: task.from,
        ref: task.ref,
        taskTitle,
        doneByAgent: task.to,
        createdAt,
      } satisfies InboxEvent)
    }
  }

  private flatten(tasks: MissionKanbanTasks): FlattenedTask[] {
    return [
      ...tasks.toClaim.map((task) => ({ task, status: 'to-claim' as const })),
      ...tasks.inProgress.map((task) => ({ task, status: 'in-progress' as const })),
      ...tasks.done.map((task) => ({ task, status: 'done' as const })),
    ]
  }
}

function firstLine(value?: string): string | undefined {
  return value?.split('\n').map((line) => line.trim()).find(Boolean)
}

function clarificationText(task: MissionKanbanTask): string | undefined {
  const value = [task.clarification, task.question]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line))
    .join('\n')
  return value || undefined
}

function shortHash(value: string): string {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 8)
}
