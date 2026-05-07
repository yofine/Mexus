import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Fastify from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import { ConfigManager } from '../workspace/ConfigManager.ts'
import { MissionService } from './MissionService.ts'
import { registerMissionRoutes } from './routes.ts'

const repoRoot = path.resolve(__dirname, '../../../..')
const tempProjects: string[] = []

function makeTempProject(): string {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-mission-routes-'))
  fs.mkdirSync(path.join(projectDir, '.claude', 'skills'), { recursive: true })
  fs.cpSync(
    path.join(repoRoot, '.claude', 'skills', 'agent-team-mission-workflow'),
    path.join(projectDir, '.claude', 'skills', 'agent-team-mission-workflow'),
    { recursive: true },
  )
  tempProjects.push(projectDir)
  return projectDir
}

afterEach(() => {
  for (const project of tempProjects.splice(0)) {
    fs.rmSync(project, { recursive: true, force: true })
  }
})

describe('Mission REST routes', () => {
  it('lists existing on-disk Missions that were not created through the API', async () => {
    const projectDir = makeTempProject()
    fs.mkdirSync(path.join(projectDir, 'agent-team/missions/hub-agent-team-mission-mvp'), { recursive: true })
    fs.copyFileSync(
      path.join(repoRoot, 'agent-team/missions/hub-agent-team-mission-mvp/mission.md'),
      path.join(projectDir, 'agent-team/missions/hub-agent-team-mission-mvp/mission.md'),
    )
    const fastify = Fastify()
    registerMissionRoutes(fastify, new MissionService(projectDir, new ConfigManager(projectDir)))

    const response = await fastify.inject({ method: 'GET', url: '/api/missions' })

    expect(response.statusCode).toBe(200)
    expect(response.json().missions).toEqual([
      expect.objectContaining({
        name: 'hub-agent-team-mission-mvp',
        complete: false,
        missingFiles: ['agents.md', 'kanban.md', 'roundtable.md', 'squad-lead.md'],
      }),
    ])
  })

  it('creates, lists, reads, activates, repairs, and returns active Missions', async () => {
    const projectDir = makeTempProject()
    const fastify = Fastify()
    registerMissionRoutes(fastify, new MissionService(projectDir, new ConfigManager(projectDir)))

    const create = await fastify.inject({
      method: 'POST',
      url: '/api/missions',
      payload: { name: 'rest-mission', originalRequest: 'REST request', activate: true },
    })
    expect(create.statusCode).toBe(201)
    expect(create.json().summary.lifecycle).toBe('active')

    const list = await fastify.inject({ method: 'GET', url: '/api/missions' })
    expect(list.json().missions).toEqual([
      expect.objectContaining({ name: 'rest-mission', complete: true }),
    ])

    const active = await fastify.inject({ method: 'GET', url: '/api/missions/active' })
    expect(active.json().summary.name).toBe('rest-mission')

    const detail = await fastify.inject({ method: 'GET', url: '/api/missions/rest-mission' })
    expect(detail.json().files.kanban.raw).toContain('Mission: `rest-mission`')

    fs.rmSync(path.join(projectDir, 'agent-team/missions/rest-mission/squad-lead.md'))
    const repair = await fastify.inject({ method: 'POST', url: '/api/missions/rest-mission/repair' })
    expect(repair.json().summary.complete).toBe(true)

    await fastify.inject({
      method: 'POST',
      url: '/api/missions',
      payload: { name: 'other', activate: false },
    })
    const activate = await fastify.inject({ method: 'POST', url: '/api/missions/other/activate' })
    expect(activate.json().summary.lifecycle).toBe('active')
  })

  it('returns safe errors for invalid Mission names', async () => {
    const projectDir = makeTempProject()
    const fastify = Fastify()
    registerMissionRoutes(fastify, new MissionService(projectDir, new ConfigManager(projectDir)))

    const response = await fastify.inject({ method: 'GET', url: '/api/missions/..%2Fescape' })

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toMatch(/Invalid Mission name/)
  })
})
