import fs from 'node:fs'
import path from 'node:path'
import type { ConfigManager } from '../workspace/ConfigManager.ts'
import type { AgentType, PaneCreateConfig } from '../types.ts'

export type MissionLifecycle = 'active' | 'inactive' | 'completed'

export interface MissionSummary {
  name: string
  path: string
  lifecycle: MissionLifecycle
  complete: boolean
  missingFiles: string[]
  title?: string
  createdBy?: string
  createdAt?: string
  taskCounts: {
    toClaim: number
    inProgress: number
    done: number
  }
  unreviewedDoneCount: number
}

export interface MissionFile {
  path: string
  exists: boolean
  raw: string
  parseError?: string
}

export interface MissionTask {
  to: string
  from: string
  scope: string
  ref?: string
  request?: string
  acceptance?: string
  updated?: string
  review?: string
  raw: string
}

export interface MissionDetail {
  summary: MissionSummary
  files: Record<MissionFileKey, MissionFile>
  kanban: {
    toClaim: MissionTask[]
    inProgress: MissionTask[]
    done: MissionTask[]
  }
}

export interface CreateMissionInput {
  name: string
  goal?: string
  originalRequest?: string
  constraints?: string
  acceptance?: string
  activate?: boolean
}

export interface MissionPaneCreator {
  createPane(config: PaneCreateConfig): unknown | Promise<unknown>
}

type TemplateKey = 'missionWorkflow' | 'agentRoster' | 'mission' | 'agents' | 'kanban' | 'roundtable' | 'squadLead'
type MissionFileKey = 'mission' | 'agents' | 'kanban' | 'roundtable' | 'squadLead'

const TEMPLATE_FILENAMES: Record<TemplateKey, string> = {
  missionWorkflow: 'mission-workflow.md',
  agentRoster: 'agent-roster-template.md',
  mission: 'mission-template.md',
  agents: 'agents-template.md',
  kanban: 'kanban-template.md',
  roundtable: 'roundtable-template.md',
  squadLead: 'squad-lead-template.md',
}

const MISSION_FILENAMES: Record<MissionFileKey, string> = {
  mission: 'mission.md',
  agents: 'agents.md',
  kanban: 'kanban.md',
  roundtable: 'roundtable.md',
  squadLead: 'squad-lead.md',
}

export function resolveMissionTemplatePaths(projectDir: string): Record<TemplateKey, string> {
  const referencesDir = path.join(projectDir, '.claude', 'skills', 'agent-team-mission-workflow', 'references')
  const resolved = {} as Record<TemplateKey, string>

  for (const [key, filename] of Object.entries(TEMPLATE_FILENAMES) as Array<[TemplateKey, string]>) {
    const templatePath = path.join(referencesDir, filename)
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Missing Mission template: ${filename} in ${referencesDir}`)
    }
    resolved[key] = templatePath
  }

  return resolved
}

function isMissionName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)
}

function assertMissionName(name: string): void {
  if (!isMissionName(name)) {
    throw new Error(`Invalid Mission name: ${name}`)
  }
}

function missionRelPath(name: string): string {
  return path.join('agent-team', 'missions', name)
}

function replaceTemplateTokens(raw: string, name: string): string {
  return raw
    .replaceAll('<mission-name>', name)
    .replaceAll('<Mission Title>', name)
    .replaceAll('<YYYY-MM-DD>', new Date().toISOString().slice(0, 10))
}

function withOriginalRequest(raw: string, originalRequest?: string): string {
  if (!originalRequest) return raw
  return raw.replace('<Preserve the user\'s original mission request or a faithful summary.>', originalRequest)
}

function readOptional(filePath: string): string {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : ''
}

function parseLifecycle(raw: string): MissionLifecycle {
  const match = raw.match(/^Lifecycle:\s*(active|inactive|completed)\s*$/m)
  return (match?.[1] as MissionLifecycle | undefined) || 'inactive'
}

function setLifecycle(raw: string, lifecycle: MissionLifecycle): string {
  if (/^Lifecycle:\s*\S+\s*$/m.test(raw)) {
    return raw.replace(/^Lifecycle:\s*\S+\s*$/m, `Lifecycle: ${lifecycle}`)
  }
  if (/^Mission:\s*`[^`]+`\s*$/m.test(raw)) {
    return raw.replace(/^(Mission:\s*`[^`]+`\s*)$/m, `$1\n\nLifecycle: ${lifecycle}`)
  }
  return `Lifecycle: ${lifecycle}\n\n${raw}`
}

function parseMissionFields(raw: string): Pick<MissionSummary, 'title' | 'createdBy' | 'createdAt'> {
  return {
    title: raw.match(/^# Mission:\s*(.+)$/m)?.[1]?.trim(),
    createdBy: raw.match(/^Created by:\s*(.+)$/m)?.[1]?.trim(),
    createdAt: raw.match(/^Created (?:at|date):\s*(.+)$/im)?.[1]?.trim(),
  }
}

function parseTaskBlock(raw: string): MissionTask | null {
  const header = raw.match(/^To:\s*(.*?)\s*\|\s*From:\s*(.*?)\s*\|\s*Scope:\s*(.*)$/m)
  if (!header) return null
  const field = (label: string) => raw.match(new RegExp(`^- ${label}:\\s*(.*)$`, 'm'))?.[1]?.trim()
  return {
    to: header[1].trim(),
    from: header[2].trim(),
    scope: header[3].trim(),
    ref: field('Ref'),
    request: field('Request'),
    acceptance: field('Acceptance'),
    updated: field('Updated'),
    review: field('Review'),
    raw,
  }
}

function splitSection(raw: string, section: string, nextSections: string[]): string | null {
  const start = raw.match(new RegExp(`^## ${section}\\s*$`, 'm'))
  if (!start || start.index === undefined) return null
  const bodyStart = start.index + start[0].length
  let bodyEnd = raw.length
  for (const next of nextSections) {
    const match = raw.slice(bodyStart).match(new RegExp(`\\n## ${next}\\s*$`, 'm'))
    if (match?.index !== undefined) {
      bodyEnd = Math.min(bodyEnd, bodyStart + match.index)
    }
  }
  return raw.slice(bodyStart, bodyEnd).trim()
}

function parseTasks(sectionRaw: string): MissionTask[] {
  if (!sectionRaw || /^No tasks /m.test(sectionRaw)) return []
  const starts = Array.from(sectionRaw.matchAll(/^To:\s.*$/gm))
    .map((match) => match.index)
    .filter((index): index is number => index !== undefined)
  return starts
    .map((start, index) => {
      const end = starts[index + 1] ?? sectionRaw.length
      return parseTaskBlock(sectionRaw.slice(start, end).trim())
    })
    .filter((task): task is MissionTask => Boolean(task))
}

function parseKanban(raw: string): { tasks: MissionDetail['kanban']; parseError?: string } {
  const toClaim = splitSection(raw, 'To Claim', ['In Progress', 'Done'])
  const inProgress = splitSection(raw, 'In Progress', ['Done'])
  const done = splitSection(raw, 'Done', [])
  if (toClaim === null || inProgress === null || done === null) {
    return {
      tasks: { toClaim: [], inProgress: [], done: [] },
      parseError: 'Kanban sections To Claim, In Progress, and Done were not all found.',
    }
  }
  return {
    tasks: {
      toClaim: parseTasks(toClaim),
      inProgress: parseTasks(inProgress),
      done: parseTasks(done),
    },
  }
}

export class MissionService {
  constructor(
    private readonly projectDir: string,
    private readonly configManager: ConfigManager,
    private readonly paneCreator?: MissionPaneCreator,
  ) {}

  listMissions(): MissionSummary[] {
    const missionsDir = path.join(this.projectDir, 'agent-team', 'missions')
    if (!fs.existsSync(missionsDir)) return []

    return fs.readdirSync(missionsDir, { withFileTypes: true })
      .filter((entry) => {
        if (!entry.isDirectory() || !isMissionName(entry.name)) return false
        return fs.existsSync(path.join(missionsDir, entry.name, 'mission.md'))
      })
      .map((entry) => this.readSummary(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  getMission(name: string): MissionDetail {
    assertMissionName(name)
    const summary = this.readSummary(name)
    if (!fs.existsSync(path.join(this.projectDir, summary.path))) {
      throw new Error(`Mission not found: ${name}`)
    }

    const files = this.readMissionFiles(name)
    const parsed = parseKanban(files.kanban.raw)
    if (parsed.parseError && files.kanban.exists) {
      files.kanban.parseError = parsed.parseError
    }

    return {
      summary: {
        ...summary,
        taskCounts: {
          toClaim: parsed.tasks.toClaim.length,
          inProgress: parsed.tasks.inProgress.length,
          done: parsed.tasks.done.length,
        },
        unreviewedDoneCount: parsed.tasks.done.filter((task) => !task.review).length,
      },
      files,
      kanban: parsed.tasks,
    }
  }

  getActiveMission(): MissionDetail | null {
    const active = this.listMissions().find((mission) => mission.lifecycle === 'active')
    return active ? this.getMission(active.name) : null
  }

  async createMission(input: CreateMissionInput): Promise<MissionDetail> {
    assertMissionName(input.name)
    const templates = resolveMissionTemplatePaths(this.projectDir)
    const existing = this.listMissions()
    const activate = input.activate ?? existing.length === 0
    const lifecycle: MissionLifecycle = activate || existing.length === 0 ? 'active' : 'inactive'
    const missionDir = path.join(this.projectDir, missionRelPath(input.name))
    if (fs.existsSync(missionDir)) {
      throw new Error(`Mission already exists: ${input.name}`)
    }

    this.ensureRootFiles(templates)
    fs.mkdirSync(missionDir, { recursive: true })
    for (const [key, filename] of Object.entries(MISSION_FILENAMES) as Array<[MissionFileKey, string]>) {
      let raw = fs.readFileSync(templates[key], 'utf-8')
      raw = replaceTemplateTokens(raw, input.name)
      if (key === 'mission') {
        raw = withOriginalRequest(raw, input.originalRequest || input.goal)
        raw = setLifecycle(raw, lifecycle)
      }
      fs.writeFileSync(path.join(missionDir, filename), raw)
    }

    if (lifecycle === 'active') {
      this.deactivateOtherMissions(input.name)
      this.setActiveMissionConfig(input.name)
    }

    await this.createSquadLeadPane(input.name)

    return this.getMission(input.name)
  }

  activateMission(name: string): MissionDetail {
    assertMissionName(name)
    const missionPath = path.join(this.projectDir, missionRelPath(name), 'mission.md')
    if (!fs.existsSync(missionPath)) {
      throw new Error(`Mission not found: ${name}`)
    }

    this.deactivateOtherMissions(name)
    this.writeMissionLifecycle(name, 'active')
    this.setActiveMissionConfig(name)
    return this.getMission(name)
  }

  repairMission(name: string): MissionDetail {
    assertMissionName(name)
    const templates = resolveMissionTemplatePaths(this.projectDir)
    const missionDir = path.join(this.projectDir, missionRelPath(name))
    if (!fs.existsSync(missionDir)) {
      throw new Error(`Mission not found: ${name}`)
    }

    this.ensureRootFiles(templates)
    for (const [key, filename] of Object.entries(MISSION_FILENAMES) as Array<[MissionFileKey, string]>) {
      const target = path.join(missionDir, filename)
      if (fs.existsSync(target)) continue
      let raw = replaceTemplateTokens(fs.readFileSync(templates[key], 'utf-8'), name)
      if (key === 'mission') {
        raw = setLifecycle(raw, 'inactive')
      }
      fs.writeFileSync(target, raw)
    }

    return this.getMission(name)
  }

  private ensureRootFiles(templates: Record<TemplateKey, string>): void {
    const agentTeamDir = path.join(this.projectDir, 'agent-team')
    fs.mkdirSync(agentTeamDir, { recursive: true })
    const workflowPath = path.join(agentTeamDir, 'mission-workflow.md')
    if (!fs.existsSync(workflowPath)) {
      fs.copyFileSync(templates.missionWorkflow, workflowPath)
    }
    const rosterPath = path.join(agentTeamDir, 'agents.md')
    if (!fs.existsSync(rosterPath)) {
      fs.copyFileSync(templates.agentRoster, rosterPath)
    }
  }

  private readMissionFiles(name: string): Record<MissionFileKey, MissionFile> {
    const result = {} as Record<MissionFileKey, MissionFile>
    for (const [key, filename] of Object.entries(MISSION_FILENAMES) as Array<[MissionFileKey, string]>) {
      const rel = path.join(missionRelPath(name), filename)
      const full = path.join(this.projectDir, rel)
      const exists = fs.existsSync(full)
      result[key] = {
        path: rel,
        exists,
        raw: exists ? fs.readFileSync(full, 'utf-8') : '',
      }
    }
    return result
  }

  private readSummary(name: string): MissionSummary {
    assertMissionName(name)
    const rel = missionRelPath(name)
    const missionDir = path.join(this.projectDir, rel)
    const missingFiles = Object.values(MISSION_FILENAMES)
      .filter((filename) => !fs.existsSync(path.join(missionDir, filename)))
    const missionRaw = readOptional(path.join(missionDir, 'mission.md'))
    const kanbanRaw = readOptional(path.join(missionDir, 'kanban.md'))
    const parsed = parseKanban(kanbanRaw)
    return {
      name,
      path: rel,
      lifecycle: parseLifecycle(missionRaw),
      complete: missingFiles.length === 0,
      missingFiles,
      ...parseMissionFields(missionRaw),
      taskCounts: {
        toClaim: parsed.tasks.toClaim.length,
        inProgress: parsed.tasks.inProgress.length,
        done: parsed.tasks.done.length,
      },
      unreviewedDoneCount: parsed.tasks.done.filter((task) => !task.review).length,
    }
  }

  private deactivateOtherMissions(activeName: string): void {
    for (const mission of this.listMissions()) {
      if (mission.name !== activeName && mission.lifecycle === 'active') {
        this.writeMissionLifecycle(mission.name, 'inactive')
      }
    }
  }

  private writeMissionLifecycle(name: string, lifecycle: MissionLifecycle): void {
    const missionPath = path.join(this.projectDir, missionRelPath(name), 'mission.md')
    const raw = readOptional(missionPath)
    fs.writeFileSync(missionPath, setLifecycle(raw, lifecycle))
  }

  private setActiveMissionConfig(name: string): void {
    const config = this.configManager.initWorkspace()
    config.active_mission = name
    this.configManager.saveWorkspaceConfig(config)
  }

  private async createSquadLeadPane(name: string): Promise<void> {
    if (!this.paneCreator) return
    const agent = this.resolveMissionDefaultAgent()
    const rel = missionRelPath(name)
    await this.paneCreator.createPane({
      name: `Squad Lead - ${name}`,
      agent,
      workdir: '.',
      task: buildSquadLeadTask(name),
      mission: {
        name,
        path: rel,
        role: 'squad-lead',
        agentName: 'Squad Lead',
      },
      restore: 'manual',
      isolation: 'shared',
      yolo: false,
    })
  }

  private resolveMissionDefaultAgent(): AgentType {
    const configured = this.configManager.loadGlobalConfig().mission_defaults?.agent_type || 'claudecode'
    if (configured === '__shell__' || !this.configManager.getAgentDefinition(configured)) {
      throw new Error(`Mission default CLI agent is not configured: ${configured}`)
    }
    return configured
  }
}

function buildSquadLeadTask(name: string): string {
  return `Use the agent-team-mission-workflow skill.
You are Squad Lead for mission \`${name}\`.
Read:
- agent-team/mission-workflow.md
- agent-team/agents.md
- agent-team/missions/${name}/mission.md
- agent-team/missions/${name}/agents.md
- agent-team/missions/${name}/kanban.md
- agent-team/missions/${name}/roundtable.md
- agent-team/missions/${name}/squad-lead.md

Create or refine the mission squad, publish initial kanban tasks, and keep Markdown files as the source of truth.
Do not implement product code unless the user explicitly asks.`
}
