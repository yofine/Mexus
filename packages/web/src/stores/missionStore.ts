import { create } from 'zustand'
import { api } from '@/lib/apiBase'

export type MissionTaskStatus = 'To Claim' | 'In Progress' | 'Done'

export interface MissionKanbanTask {
  id: string
  status: MissionTaskStatus
  to: string
  from: string
  scope: string
  ref: string
  request: string
  reason: string
  acceptance: string
  result: string
  files: string
  verification: string
  review: string
  updated: string
  raw: string
  line: number
}

export interface MissionTaskCounts {
  toClaim: number
  inProgress: number
  done: number
  unreviewedDone: number
}

export interface MissionKanbanParseResult {
  ok: boolean
  raw: string
  error?: string
  tasks: MissionKanbanTask[]
  counts: MissionTaskCounts
}

export interface MissionAgentObservation {
  name: string
  responsibility: string
  activationPromptSummary: string
  initialPromptSummary: string
  taskCounts: Omit<MissionTaskCounts, 'unreviewedDone'> & { total: number }
}

export interface MissionAgentsParseResult {
  ok: boolean
  raw: string
  error?: string
  agents: MissionAgentObservation[]
}

export interface SquadLeadLogEntry {
  id: string
  date: string
  actor: string
  detail: string
  line: number
}

export interface SquadLeadLogParseResult {
  ok: boolean
  raw: string
  error?: string
  entries: SquadLeadLogEntry[]
}

export interface MissionOverview {
  name: string
  lifecycle: string
  date: string
  intent: string
  acceptance: string[]
}

export interface MissionSummary {
  name: string
  path?: string
  lifecycle?: string
  complete?: boolean
  incomplete?: boolean
  missingFiles?: string[]
  createdAt?: string
  date?: string
}

interface MissionFilePayload {
  path: string
  exists: boolean
  raw: string
  parseError?: string
}

export interface MissionDetails extends MissionSummary {
  files?: Record<string, string | MissionFilePayload>
  raw?: Record<string, string | MissionFilePayload>
  content?: Record<string, string | MissionFilePayload>
  summary?: MissionSummary
  kanban?: unknown
}

interface MissionStore {
  missions: MissionSummary[]
  activeMission: MissionDetails | null
  selectedMission: MissionDetails | null
  isLoading: boolean
  error: string | null
  kanban: MissionKanbanParseResult | null
  agents: MissionAgentsParseResult | null
  squadLeadLog: SquadLeadLogParseResult | null
  overview: MissionOverview | null
  loadMissions: () => Promise<void>
  loadActiveMission: () => Promise<void>
  loadMission: (name: string, options?: { silent?: boolean }) => Promise<void>
  refresh: () => Promise<void>
  activateMission: (name: string) => Promise<void>
  createMission: (input: { name: string; goal?: string; constraints?: string; acceptance?: string }) => Promise<boolean>
}

const STATUS_HEADINGS: MissionTaskStatus[] = ['To Claim', 'In Progress', 'Done']
const EMPTY_COUNTS: MissionTaskCounts = { toClaim: 0, inProgress: 0, done: 0, unreviewedDone: 0 }

function countTasks(tasks: MissionKanbanTask[]): MissionTaskCounts {
  return tasks.reduce<MissionTaskCounts>((counts, task) => {
    if (task.status === 'To Claim') counts.toClaim += 1
    if (task.status === 'In Progress') counts.inProgress += 1
    if (task.status === 'Done') {
      counts.done += 1
      if (!task.review.trim()) counts.unreviewedDone += 1
    }
    return counts
  }, { ...EMPTY_COUNTS })
}

function normalizeBackticks(value: string): string {
  return value.trim().replace(/^`|`$/g, '').trim()
}

function summarizePrompt(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
}

function sectionAfterHeading(markdown: string, heading: string): string | null {
  const match = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm').exec(markdown)
  if (!match) return null
  const start = match.index + match[0].length
  const next = /^##\s+/m.exec(markdown.slice(start))
  return next ? markdown.slice(start, start + next.index) : markdown.slice(start)
}

function parseTopLevelField(markdown: string, field: string): string {
  const match = new RegExp(`^${field}:\\s*(.+)$`, 'm').exec(markdown)
  return match ? normalizeBackticks(match[1]) : ''
}

export function parseMissionOverview(markdown: string): MissionOverview {
  const intent = (sectionAfterHeading(markdown, 'Mission Intent') || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('-')) || ''
  const acceptanceSection = sectionAfterHeading(markdown, 'Minimum Acceptance Standard') || ''
  return {
    name: parseTopLevelField(markdown, 'Mission'),
    lifecycle: parseTopLevelField(markdown, 'Lifecycle'),
    date: parseTopLevelField(markdown, 'Date'),
    intent,
    acceptance: acceptanceSection
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- '))
      .map((line) => line.slice(2).trim()),
  }
}

interface MissionDetailsEnvelope {
  mission?: MissionDetails
}

function isMissionDetailsEnvelope(payload: MissionDetails | MissionDetailsEnvelope): payload is MissionDetailsEnvelope {
  return Object.prototype.hasOwnProperty.call(payload, 'mission')
}

function normalizeMissionSummary(summary: MissionSummary): MissionSummary {
  return {
    ...summary,
    incomplete: summary.incomplete ?? (typeof summary.complete === 'boolean' ? !summary.complete : undefined),
  }
}

function normalizeMissionDetails(payload: MissionDetails | MissionDetailsEnvelope | null): MissionDetails | null {
  if (!payload) return null
  const detail = (isMissionDetailsEnvelope(payload) ? payload.mission : payload) as MissionDetails | undefined
  if (!detail) return null
  const summary = normalizeMissionSummary(detail.summary || detail)
  return {
    ...summary,
    ...detail,
    incomplete: detail.incomplete ?? summary.incomplete,
    files: detail.files || detail.content || detail.raw,
  }
}

function normalizeMissionList(payload: MissionSummary[] | { missions?: MissionSummary[] } | null): MissionSummary[] {
  const missions = Array.isArray(payload) ? payload : payload?.missions || []
  return missions.map(normalizeMissionSummary)
}

function parseTaskField(block: string, field: string): string {
  const lines = block.split(/\r?\n/)
  const start = lines.findIndex((line) => line.startsWith(`- ${field}:`))
  if (start === -1) return ''
  const first = lines[start].slice(`- ${field}:`.length).trim()
  const rest: string[] = []
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^- [A-Z][A-Za-z ]*:\s*/.test(lines[i]) || /^To:\s/.test(lines[i])) break
    rest.push(lines[i])
  }
  return [first, ...rest].join('\n').trim()
}

function parseTaskBlock(raw: string, status: MissionTaskStatus, line: number): MissionKanbanTask | null {
  const header = /^To:\s*(.*?)\s*\|\s*From:\s*(.*?)\s*\|\s*Scope:\s*(.*?)\s*$/m.exec(raw)
  if (!header) return null
  const ref = parseTaskField(raw, 'Ref')
  return {
    id: ref || `${status}:${line}`,
    status,
    to: header[1].trim(),
    from: header[2].trim(),
    scope: normalizeBackticks(header[3]),
    ref,
    request: parseTaskField(raw, 'Request'),
    reason: parseTaskField(raw, 'Reason'),
    acceptance: parseTaskField(raw, 'Acceptance'),
    result: parseTaskField(raw, 'Result'),
    files: parseTaskField(raw, 'Files'),
    verification: parseTaskField(raw, 'Verification'),
    review: parseTaskField(raw, 'Review'),
    updated: parseTaskField(raw, 'Updated'),
    raw,
    line,
  }
}

export function parseMissionKanban(markdown: string): MissionKanbanParseResult {
  try {
    const tasks: MissionKanbanTask[] = []
    const missing = STATUS_HEADINGS.filter((status) => sectionAfterHeading(markdown, status) === null)
    if (missing.length > 0) {
      return { ok: false, raw: markdown, error: `Missing kanban status section: ${missing.join(', ')}`, tasks: [], counts: { ...EMPTY_COUNTS } }
    }

    for (const status of STATUS_HEADINGS) {
      const section = sectionAfterHeading(markdown, status) || ''
      const headingMatch = new RegExp(`^##\\s+${status.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm').exec(markdown)
      const sectionStart = headingMatch ? headingMatch.index + headingMatch[0].length : 0
      const matches = [...section.matchAll(/^To:\s.*(?:\r?\n(?!To:\s|##\s).*)*/gm)]
      for (const match of matches) {
        const line = markdown.slice(0, sectionStart + (match.index || 0)).split(/\r?\n/).length
        const task = parseTaskBlock(match[0].trim(), status, line)
        if (task) tasks.push(task)
      }
    }

    if (tasks.length === 0) {
      return { ok: false, raw: markdown, error: 'No kanban task blocks found in status sections.', tasks: [], counts: { ...EMPTY_COUNTS } }
    }

    return { ok: true, raw: markdown, tasks, counts: countTasks(tasks) }
  } catch (error) {
    return {
      ok: false,
      raw: markdown,
      error: error instanceof Error ? error.message : 'Unable to parse kanban markdown.',
      tasks: [],
      counts: { ...EMPTY_COUNTS },
    }
  }
}

function taskCountsForAgent(name: string, tasks: MissionKanbanTask[]): MissionAgentObservation['taskCounts'] {
  const counts = countTasks(tasks.filter((task) => task.to === name))
  return {
    toClaim: counts.toClaim,
    inProgress: counts.inProgress,
    done: counts.done,
    total: counts.toClaim + counts.inProgress + counts.done,
  }
}

function parsePromptBlock(section: string, label: string): string {
  const match = new RegExp(`${label}:\\s*\\n\\s*\`\`\`(?:\\w+)?\\n([\\s\\S]*?)\\n\\s*\`\`\``, 'i').exec(section)
  return match ? summarizePrompt(match[1]) : ''
}

function parseAgentField(section: string, field: string): string {
  const match = new RegExp(`^${field}:\\s*(.+)$`, 'm').exec(section)
  return match ? match[1].trim() : ''
}

function parseAgentsFromTable(markdown: string): Map<string, string> {
  const agents = new Map<string, string>()
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^\|\s*`?([^`|]+?)`?\s*\|\s*(.+?)\s*\|$/.exec(line)
    if (!match) continue
    const name = match[1].trim()
    const responsibility = match[2].trim()
    if (!name || name === '---' || name === 'Agent Name') continue
    agents.set(name, responsibility)
  }
  return agents
}

export function parseMissionAgents(markdown: string, tasks: MissionKanbanTask[] = []): MissionAgentsParseResult {
  try {
    const tableAgents = parseAgentsFromTable(markdown)
    const agents: MissionAgentObservation[] = []
    const agentSections = markdown.split(/^## Agent:\s*/m).slice(1)

    for (const rawSection of agentSections) {
      const [rawName = '', ...sectionLines] = rawSection.split(/\r?\n/)
      const name = normalizeBackticks(rawName)
      const section = sectionLines.join('\n')
      const responsibility = parseAgentField(section, 'Responsibility') || tableAgents.get(name) || ''
      agents.push({
        name,
        responsibility,
        activationPromptSummary: parsePromptBlock(section, 'Activation prompt'),
        initialPromptSummary: parsePromptBlock(section, 'Initial prompt'),
        taskCounts: taskCountsForAgent(name, tasks),
      })
    }

    for (const [name, responsibility] of tableAgents) {
      if (!agents.some((agent) => agent.name === name)) {
        agents.push({
          name,
          responsibility,
          activationPromptSummary: '',
          initialPromptSummary: '',
          taskCounts: taskCountsForAgent(name, tasks),
        })
      }
    }

    if (agents.length === 0) {
      return { ok: false, raw: markdown, error: 'No mission agents found.', agents: [] }
    }

    return { ok: true, raw: markdown, agents }
  } catch (error) {
    return {
      ok: false,
      raw: markdown,
      error: error instanceof Error ? error.message : 'Unable to parse mission agents markdown.',
      agents: [],
    }
  }
}

export function parseSquadLeadLog(markdown: string): SquadLeadLogParseResult {
  try {
    const section = sectionAfterHeading(markdown, 'Work Log')
    if (section === null) {
      return { ok: false, raw: markdown, error: 'No Work Log section found in squad-lead.md.', entries: [] }
    }

    const sectionStart = markdown.indexOf(section)
    const entries: SquadLeadLogEntry[] = []
    for (const match of section.matchAll(/^\s*-\s+(.+)$/gm)) {
      const raw = match[1].trim()
      const line = markdown.slice(0, sectionStart + (match.index || 0)).split(/\r?\n/).length
      const parts = raw.split(/,\s*/)
      const date = parts[0] || ''
      const actor = parts[1] || 'Squad Lead'
      const detail = parts.slice(2).join(', ').trim() || raw
      entries.push({
        id: `${line}:${raw}`,
        date,
        actor,
        detail,
        line,
      })
    }

    if (entries.length === 0) {
      return { ok: false, raw: markdown, error: 'No Work Log entries found in squad-lead.md.', entries: [] }
    }

    return { ok: true, raw: markdown, entries }
  } catch (error) {
    return {
      ok: false,
      raw: markdown,
      error: error instanceof Error ? error.message : 'Unable to parse Squad Lead work log.',
      entries: [],
    }
  }
}

function missionFileKeys(file: string): string[] {
  const aliases: Record<string, string> = {
    'mission.md': 'mission',
    'agents.md': 'agents',
    'kanban.md': 'kanban',
    'roundtable.md': 'roundtable',
    'squad-lead.md': 'squadLead',
  }
  return [file, aliases[file]].filter((key): key is string => Boolean(key))
}

function readFilePayloadValue(value: string | MissionFilePayload | undefined): string {
  if (!value) return ''
  return typeof value === 'string' ? value : value.raw
}

function readFilePayloadParseError(value: string | MissionFilePayload | undefined): string | undefined {
  return typeof value === 'object' ? value.parseError : undefined
}

function readMissionFileValue(details: MissionDetails | null, file: string): string | MissionFilePayload | undefined {
  for (const key of missionFileKeys(file)) {
    const value = details?.files?.[key] || details?.content?.[key] || details?.raw?.[key]
    if (value) return value
  }
  return undefined
}

function readMissionFile(details: MissionDetails | null, file: string): string {
  return readFilePayloadValue(readMissionFileValue(details, file))
}

function readMissionFileParseError(details: MissionDetails | null, file: string): string | undefined {
  return readFilePayloadParseError(readMissionFileValue(details, file))
}

function deriveMissionState(details: MissionDetails | null): Pick<MissionStore, 'kanban' | 'agents' | 'squadLeadLog' | 'overview'> {
  const missionRaw = readMissionFile(details, 'mission.md')
  const kanbanRaw = readMissionFile(details, 'kanban.md')
  const agentsRaw = readMissionFile(details, 'agents.md')
  const squadLeadRaw = readMissionFile(details, 'squad-lead.md')
  const kanbanParseError = readMissionFileParseError(details, 'kanban.md')
  const kanban = kanbanRaw
    ? (kanbanParseError
      ? { ok: false, raw: kanbanRaw, error: kanbanParseError, tasks: [], counts: { ...EMPTY_COUNTS } }
      : parseMissionKanban(kanbanRaw))
    : null
  const agents = agentsRaw ? parseMissionAgents(agentsRaw, kanban?.tasks || []) : null
  const squadLeadLog = squadLeadRaw ? parseSquadLeadLog(squadLeadRaw) : null
  const overview = missionRaw ? parseMissionOverview(missionRaw) : null
  return { kanban, agents, squadLeadLog, overview }
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(api(path), { cache: 'no-store' })
  if (!response.ok) throw new Error(await response.text())
  return response.json() as Promise<T>
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(api(path), {
    method: 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
  return response.json() as Promise<T>
}

export const useMissionStore = create<MissionStore>((set) => ({
  missions: [],
  activeMission: null,
  selectedMission: null,
  isLoading: false,
  error: null,
  kanban: null,
  agents: null,
  squadLeadLog: null,
  overview: null,

  loadMissions: async () => {
    set({ isLoading: true, error: null })
    try {
      const missions = normalizeMissionList(await fetchJson<MissionSummary[] | { missions?: MissionSummary[] }>('/api/missions'))
      set({ missions, isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to load missions.', isLoading: false })
    }
  },

  loadActiveMission: async () => {
    set({ isLoading: true, error: null })
    try {
      const activeMission = normalizeMissionDetails(await fetchJson<MissionDetails | { mission?: MissionDetails }>('/api/missions/active'))
      set({ activeMission, selectedMission: activeMission, ...deriveMissionState(activeMission), isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to load active mission.', activeMission: null, selectedMission: null, kanban: null, agents: null, squadLeadLog: null, overview: null, isLoading: false })
    }
  },

  loadMission: async (name: string, options) => {
    const silent = Boolean(options?.silent)
    set(silent ? { error: null } : { isLoading: true, error: null })
    try {
      const selectedMission = normalizeMissionDetails(await fetchJson<MissionDetails | { mission?: MissionDetails }>(`/api/missions/${encodeURIComponent(name)}`))
      set({ selectedMission, ...deriveMissionState(selectedMission), ...(silent ? {} : { isLoading: false }) })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to load mission.', ...(silent ? {} : { isLoading: false }) })
    }
  },

  refresh: async () => {
    const selectedName = useMissionStore.getState().selectedMission?.name
    await useMissionStore.getState().loadMissions()
    const missions = useMissionStore.getState().missions
    const nextName = selectedName || missions.find((mission) => mission.lifecycle === 'active')?.name || missions[0]?.name
    if (nextName) {
      await useMissionStore.getState().loadMission(nextName)
      const selected = useMissionStore.getState().selectedMission
      set({ activeMission: selected?.lifecycle === 'active' ? selected : useMissionStore.getState().activeMission })
    } else {
      set({ activeMission: null, selectedMission: null, kanban: null, agents: null, squadLeadLog: null, overview: null })
    }
  },

  activateMission: async (name: string) => {
    set({ isLoading: true, error: null })
    try {
      const activeMission = normalizeMissionDetails(await postJson<MissionDetails | { mission?: MissionDetails }>(`/api/missions/${encodeURIComponent(name)}/activate`))
      await useMissionStore.getState().loadMissions()
      if (activeMission?.name) {
        set({ activeMission, selectedMission: activeMission, ...deriveMissionState(activeMission), isLoading: false })
      } else {
        await useMissionStore.getState().loadMission(name)
        set((state) => ({ activeMission: state.selectedMission, isLoading: false }))
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to activate mission.', isLoading: false })
    }
  },

  createMission: async (input) => {
    set({ isLoading: true, error: null })
    try {
      const created = normalizeMissionDetails(await postJson<MissionDetails | { mission?: MissionDetails }>('/api/missions', input))
      await useMissionStore.getState().loadMissions()
      if (created?.name) {
        await useMissionStore.getState().loadMission(created.name)
      }
      set({ isLoading: false })
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to create mission.', isLoading: false })
      return false
    }
  },
}))
