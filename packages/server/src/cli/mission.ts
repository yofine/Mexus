import type { MissionDetail, MissionSummary } from '../mission/MissionService.ts'
import { parseMissionKanban, parseMissionRoundtable } from '../mission/missionParsers.ts'
import type { PaneState } from '../types.ts'
import { CliError, type CliHttpClient, type CliIo, printJson, requestJson, requireArg, takeFlag } from './http.ts'

interface MissionListResponse {
  missions: MissionSummary[]
}

interface PaneListResponse {
  panes: PaneState[]
}

export async function runMissionCommand(args: string[], serverUrl: string, client: CliHttpClient, io: CliIo): Promise<void> {
  const [command, ...rest] = args
  switch (command) {
    case 'list':
      await listMissions(rest, serverUrl, client, io)
      return
    case 'active':
      await activeMission(rest, serverUrl, client, io)
      return
    case 'activate':
      await activateMission(rest, serverUrl, client, io)
      return
    case 'archive':
      await archiveMission(rest, serverUrl, client, io)
      return
    case 'validate':
      await validateMission(rest, serverUrl, client, io)
      return
    default:
      throw new CliError('Usage: mexus mission <list|active|activate|archive|validate>')
  }
}

async function listMissions(args: string[], serverUrl: string, client: CliHttpClient, io: CliIo): Promise<void> {
  const json = takeFlag(args, '--json')
  if (args.length > 0) throw new CliError(`Unknown mission list argument: ${args[0]}`)
  const response = await requestJson<MissionListResponse>(client, `${serverUrl}/api/missions`)
  if (json) {
    printJson(io, response)
  } else {
    for (const mission of response.missions) {
      io.stdout(`${mission.name} [${mission.lifecycle}]${mission.complete ? '' : ' incomplete'}`)
    }
  }
}

async function activeMission(args: string[], serverUrl: string, client: CliHttpClient, io: CliIo): Promise<void> {
  const json = takeFlag(args, '--json')
  if (args.length > 0) throw new CliError(`Unknown mission active argument: ${args[0]}`)
  const response = await requestJson<MissionDetail>(client, `${serverUrl}/api/missions/active`)
  if (json) {
    printJson(io, response)
  } else {
    io.stdout(`${response.summary.name} [${response.summary.lifecycle}]`)
  }
}

async function activateMission(args: string[], serverUrl: string, client: CliHttpClient, io: CliIo): Promise<void> {
  const name = requireArg(args[0], 'Missing Mission name')
  if (args.length > 1) throw new CliError(`Unknown mission activate argument: ${args[1]}`)
  const response = await requestJson<MissionDetail>(client, `${serverUrl}/api/missions/${encodeURIComponent(name)}/activate`, { method: 'POST' })
  io.stdout(`Activated Mission ${response.summary.name}`)
}

async function archiveMission(args: string[], serverUrl: string, client: CliHttpClient, io: CliIo): Promise<void> {
  const force = takeFlag(args, '--force')
  const name = requireArg(args[0], 'Missing Mission name')
  if (args.length > 1) throw new CliError(`Unknown mission archive argument: ${args[1]}`)

  if (!force) {
    const panes = await requestJson<PaneListResponse>(client, `${serverUrl}/api/panes?mission=${encodeURIComponent(name)}`)
    const running = panes.panes.filter((pane) => pane.status === 'running')
    if (running.length > 0) {
      throw new CliError(`Mission has running panes: ${running.map((pane) => pane.id).join(', ')}. Re-run with --force to close them.`)
    }
  }

  const response = await requestJson<{ name: string; path: string; closedPaneIds: string[] }>(client, `${serverUrl}/api/missions/${encodeURIComponent(name)}/archive`, {
    method: 'POST',
    body: JSON.stringify({ force }),
  })
  io.stdout(`Archived Mission ${response.name} to ${response.path}`)
}

async function validateMission(args: string[], serverUrl: string, client: CliHttpClient, io: CliIo): Promise<void> {
  const json = takeFlag(args, '--json')
  const name = requireArg(args[0], 'Missing Mission name')
  if (args.length > 1) throw new CliError(`Unknown mission validate argument: ${args[1]}`)

  const mission = await requestJson<MissionDetail>(client, `${serverUrl}/api/missions/${encodeURIComponent(name)}`)
  const required = ['mission', 'agents', 'kanban', 'roundtable', 'squadLead'] as const
  const errors: string[] = []
  for (const key of required) {
    if (!mission.files[key]?.exists) errors.push(`Missing required file: ${mission.files[key]?.path || key}`)
  }
  const kanban = parseMissionKanban(mission.files.kanban?.raw || '')
  if (!kanban.ok) errors.push(`Invalid kanban.md: ${kanban.error}`)
  const roundtable = parseMissionRoundtable(mission.files.roundtable?.raw || '')
  if (!roundtable.ok) errors.push(`Invalid roundtable.md: ${roundtable.error}`)

  const report = { ok: errors.length === 0, mission: name, errors }
  if (json) {
    printJson(io, report)
  } else if (report.ok) {
    io.stdout(`Mission ${name} is valid`)
  } else {
    for (const error of errors) io.stderr(error)
  }
  if (!report.ok) throw new CliError(`Mission ${name} is invalid`)
}
