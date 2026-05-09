import type { FastifyInstance } from 'fastify'
import type { AgentType, IsolationMode, PaneCreateConfig, PaneMission, RestoreMode } from '../types.ts'
import type { ConfigManager } from '../workspace/ConfigManager.ts'
import type { WorkspaceManager } from '../workspace/WorkspaceManager.ts'

type PaneCreateBody = {
  name?: unknown
  agent?: unknown
  workdir?: unknown
  task?: unknown
  mission?: unknown
  isolation?: unknown
  restore?: unknown
  yolo?: unknown
  runtime?: unknown
}

const RESTORE_MODES = new Set<RestoreMode>(['continue', 'restart', 'manual', 'resume'])
const ISOLATION_MODES = new Set<IsolationMode>(['shared', 'worktree'])

export function registerPaneRoutes(
  fastify: FastifyInstance,
  workspaceManager: WorkspaceManager,
  configManager: ConfigManager,
): void {
  fastify.post('/api/panes', async (request, reply) => {
    const parsed = parsePaneCreateBody(request.body as PaneCreateBody, configManager)
    if (!parsed.ok) {
      reply.code(400)
      return { error: parsed.error }
    }

    try {
      const pane = await workspaceManager.createPane(parsed.config)
      reply.code(201)
      return { pane }
    } catch (err) {
      reply.code(400)
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  fastify.get('/api/panes', async (request) => {
    const { mission } = request.query as { mission?: string }
    const panes = workspaceManager.getPanes().filter((pane) => {
      return !mission || pane.mission?.name === mission
    })
    return { panes }
  })

  fastify.delete('/api/panes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const exists = workspaceManager.getPanes().some((pane) => pane.id === id)
    if (!exists) {
      reply.code(404)
      return { error: `Pane not found: ${id}` }
    }

    await workspaceManager.closePane(id)
    return { ok: true }
  })
}

function parsePaneCreateBody(
  body: PaneCreateBody,
  configManager: ConfigManager,
): { ok: true; config: PaneCreateConfig } | { ok: false; error: string } {
  if (!isRecord(body)) return { ok: false, error: 'Request body must be an object' }

  const name = stringField(body.name)?.trim()
  if (!name) return { ok: false, error: 'Pane name is required' }

  const agent = stringField(body.agent)
  if (!agent || agent === '__shell__' || !configManager.getAgentDefinition(agent)) {
    return { ok: false, error: `Unknown agent: ${agent || ''}`.trim() }
  }

  const restore = body.restore === undefined ? 'manual' : stringField(body.restore)
  if (!restore || !RESTORE_MODES.has(restore as RestoreMode)) {
    return { ok: false, error: `Invalid restore mode: ${String(body.restore)}` }
  }

  const isolation = body.isolation === undefined ? 'shared' : stringField(body.isolation)
  if (!isolation || !ISOLATION_MODES.has(isolation as IsolationMode)) {
    return { ok: false, error: `Invalid isolation mode: ${String(body.isolation)}` }
  }

  const mission = body.mission === undefined ? undefined : parseMission(body.mission)
  if (mission && !mission.ok) return { ok: false, error: mission.error }

  if (body.workdir !== undefined && typeof body.workdir !== 'string') return { ok: false, error: 'workdir must be a string' }
  if (body.task !== undefined && typeof body.task !== 'string') return { ok: false, error: 'task must be a string' }
  if (body.yolo !== undefined && typeof body.yolo !== 'boolean') return { ok: false, error: 'yolo must be a boolean' }

  return {
    ok: true,
    config: {
      name,
      agent: agent as AgentType,
      workdir: body.workdir as string | undefined,
      task: body.task as string | undefined,
      mission: mission?.mission,
      restore: restore as RestoreMode,
      isolation: isolation as IsolationMode,
      yolo: body.yolo === true,
    },
  }
}

function parseMission(value: unknown): { ok: true; mission: PaneMission } | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: 'mission must be an object' }

  const name = stringField(value.name)?.trim()
  const missionPath = stringField(value.path)?.trim()
  const role = stringField(value.role)
  const agentName = stringField(value.agentName)?.trim()

  if (!name) return { ok: false, error: 'mission.name is required' }
  if (!missionPath) return { ok: false, error: 'mission.path is required' }
  if (role !== 'squad-lead' && role !== 'mission-agent') {
    return { ok: false, error: 'mission.role must be squad-lead or mission-agent' }
  }

  return {
    ok: true,
    mission: {
      name,
      path: missionPath,
      role,
      agentName,
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}
