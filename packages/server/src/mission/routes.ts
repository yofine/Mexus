import type { FastifyInstance } from 'fastify'
import type { MissionService } from './MissionService.ts'

export interface MissionRouteOptions {
  allowCreate?: boolean
  createDisabledMessage?: string
}

function errorStatus(err: unknown): number {
  const message = err instanceof Error ? err.message : String(err)
  if (/Invalid Mission name/.test(message)) return 400
  if (/not found/i.test(message)) return 404
  if (/already exists/i.test(message)) return 409
  if (/Missing Mission template/.test(message)) return 500
  return 400
}

function errorPayload(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : String(err) }
}

export function registerMissionRoutes(fastify: FastifyInstance, missionService: MissionService, options: MissionRouteOptions = {}): void {
  const allowCreate = options.allowCreate ?? true

  fastify.get('/api/missions', async () => {
    return { missions: missionService.listMissions() }
  })

  fastify.post('/api/missions', async (request, reply) => {
    if (!allowCreate) {
      reply.code(400)
      return { error: options.createDisabledMessage || 'Mission creation is disabled here' }
    }
    try {
      const mission = await missionService.createMission(request.body as {
        name: string
        originalRequest?: string
        constraints?: string
        acceptance?: string
        activate?: boolean
      })
      reply.code(201)
      return mission
    } catch (err) {
      reply.code(errorStatus(err))
      return errorPayload(err)
    }
  })

  fastify.get('/api/missions/active', async (request, reply) => {
    const mission = missionService.getActiveMission()
    if (!mission) {
      reply.code(404)
      return { error: 'No active Mission found' }
    }
    return mission
  })

  fastify.get('/api/missions/:name', async (request, reply) => {
    try {
      const { name } = request.params as { name: string }
      return missionService.getMission(name)
    } catch (err) {
      reply.code(errorStatus(err))
      return errorPayload(err)
    }
  })

  fastify.post('/api/missions/:name/activate', async (request, reply) => {
    try {
      const { name } = request.params as { name: string }
      return missionService.activateMission(name)
    } catch (err) {
      reply.code(errorStatus(err))
      return errorPayload(err)
    }
  })

  fastify.post('/api/missions/:name/repair', async (request, reply) => {
    try {
      const { name } = request.params as { name: string }
      return missionService.repairMission(name)
    } catch (err) {
      reply.code(errorStatus(err))
      return errorPayload(err)
    }
  })
}
