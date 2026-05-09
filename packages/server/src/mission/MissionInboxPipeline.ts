import path from 'node:path'
import type { MissionService } from './MissionService.ts'
import type { WorkspaceManager } from '../workspace/WorkspaceManager.ts'
import { MissionInboxService } from './MissionInboxService.ts'
import { MissionKanbanWatcher } from './MissionKanbanWatcher.ts'
import { MissionRoundtableWatcher } from './MissionRoundtableWatcher.ts'
import { MissionPaneNotifier } from './MissionPaneNotifier.ts'
import { parseMissionKanban, parseMissionRoundtable } from './missionParsers.ts'

type WatcherLike = {
  start: () => void | Promise<void>
  stop: () => void | Promise<void>
}

type NotifierLike = {
  start: () => void
  stop: () => void
}

interface MissionInboxPipelineFactories {
  inbox?: (stateFilePath: string) => MissionInboxService
  notifier?: (workspaceManager: WorkspaceManager, inboxService: MissionInboxService) => NotifierLike
  kanbanWatcher?: (missionPath: string, parser: typeof parseMissionKanban, inboxService: MissionInboxService) => WatcherLike
  roundtableWatcher?: (
    missionPath: string,
    parser: typeof parseMissionRoundtable,
    inboxService: MissionInboxService,
    agentRoster: () => string[],
  ) => WatcherLike
}

export interface MissionInboxPipelineOptions {
  projectDir: string
  missionService: MissionService
  workspaceManager: WorkspaceManager
  factories?: MissionInboxPipelineFactories
}

export class MissionInboxPipeline {
  private readonly inboxService: MissionInboxService
  private readonly notifier: NotifierLike
  private kanbanWatcher: WatcherLike | null = null
  private roundtableWatcher: WatcherLike | null = null
  private activeMissionName: string | null = null
  private started = false

  constructor(private readonly options: MissionInboxPipelineOptions) {
    const stateFile = path.join(options.projectDir, '.nexus', 'mission-inbox.json')
    this.inboxService = options.factories?.inbox?.(stateFile) ?? new MissionInboxService(stateFile)
    this.notifier = options.factories?.notifier?.(options.workspaceManager, this.inboxService)
      ?? new MissionPaneNotifier(options.workspaceManager, this.inboxService)
  }

  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    this.notifier.start()
    await this.restartForActiveMission()
  }

  async stop(): Promise<void> {
    await this.stopWatchers()
    this.notifier.stop()
    this.inboxService.flush()
    this.started = false
  }

  async restartForActiveMission(): Promise<void> {
    await this.stopWatchers()
    this.inboxService.flush()

    const active = this.options.missionService.getActiveMission()
    if (!active) {
      this.activeMissionName = null
      return
    }

    this.activeMissionName = active.summary.name
    const missionPath = path.join(this.options.projectDir, active.summary.path)
    this.kanbanWatcher = this.options.factories?.kanbanWatcher?.(missionPath, parseMissionKanban, this.inboxService)
      ?? new MissionKanbanWatcher(missionPath, parseMissionKanban, this.inboxService)
    this.roundtableWatcher = this.options.factories?.roundtableWatcher?.(
      missionPath,
      parseMissionRoundtable,
      this.inboxService,
      () => this.getAgentRoster(),
    ) ?? new MissionRoundtableWatcher(missionPath, parseMissionRoundtable, this.inboxService, () => this.getAgentRoster())

    await this.kanbanWatcher.start()
    await this.roundtableWatcher.start()
  }

  getAgentRoster(): string[] {
    if (!this.activeMissionName) return ['Squad Lead']
    try {
      const mission = this.options.missionService.getMission(this.activeMissionName)
      const names = [
        ...mission.kanban.toClaim,
        ...mission.kanban.inProgress,
        ...mission.kanban.done,
      ].map((task) => task.to).filter(Boolean)
      return [...new Set([...names, 'Squad Lead'])]
    } catch {
      return ['Squad Lead']
    }
  }

  private async stopWatchers(): Promise<void> {
    const watchers = [this.kanbanWatcher, this.roundtableWatcher].filter((watcher): watcher is WatcherLike => Boolean(watcher))
    this.kanbanWatcher = null
    this.roundtableWatcher = null
    for (const watcher of watchers) {
      await watcher.stop().catch(() => {})
    }
  }
}
