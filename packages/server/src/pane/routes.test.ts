import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Fastify from 'fastify'
import yaml from 'js-yaml'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildHubServer } from '../hub/index.ts'
import { ConfigManager } from '../workspace/ConfigManager.ts'
import { WorkspaceManager } from '../workspace/WorkspaceManager.ts'
import { registerPaneRoutes } from './routes.ts'

vi.mock('../pty/PtyManager.ts', () => {
  class PtyManager {
    spawn() {
      return 1234
    }
    kill() {}
    killAll() {}
    onData() {}
    onStatus() {}
    onMeta() {}
    onActivity() {}
    getScrollback() {
      return ''
    }
    write() {}
    resize() {}
  }

  return { PtyManager }
})

const tempProjects: string[] = []
let previousGlobalConfigDir: string | undefined
let previousCwd: string | undefined

function makeTempProject(prefix: string): string {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  tempProjects.push(projectDir)
  return projectDir
}

function useTempGlobalConfig(projectDir: string): void {
  previousGlobalConfigDir = process.env.NEXUS_GLOBAL_CONFIG_DIR
  process.env.NEXUS_GLOBAL_CONFIG_DIR = path.join(projectDir, '.global-nexus')
}

afterEach(() => {
  if (previousGlobalConfigDir === undefined) {
    delete process.env.NEXUS_GLOBAL_CONFIG_DIR
  } else {
    process.env.NEXUS_GLOBAL_CONFIG_DIR = previousGlobalConfigDir
  }
  previousGlobalConfigDir = undefined

  if (previousCwd) {
    process.chdir(previousCwd)
    previousCwd = undefined
  }

  for (const project of tempProjects.splice(0)) {
    fs.rmSync(project, { recursive: true, force: true })
  }
})

describe('Pane REST routes', () => {
  it('creates, lists by Mission, closes, and persists Pane lifecycle through WorkspaceManager', async () => {
    const projectDir = makeTempProject('nexus-pane-routes-')
    useTempGlobalConfig(projectDir)
    const configManager = new ConfigManager(projectDir)
    const workspaceManager = new WorkspaceManager(configManager)
    await workspaceManager.init()
    const fastify = Fastify()
    registerPaneRoutes(fastify, workspaceManager, configManager)

    const create = await fastify.inject({
      method: 'POST',
      url: '/api/panes',
      payload: {
        name: 'Bael - backend API',
        agent: 'codex',
        workdir: 'packages/server',
        task: 'Implement Pane REST routes',
        mission: {
          name: 'hub-agent-team-mission-mvp',
          path: 'agent-team/missions/hub-agent-team-mission-mvp',
          role: 'mission-agent',
          agentName: 'Bael',
        },
        restore: 'manual',
        isolation: 'shared',
        yolo: true,
        runtime: 'pty',
      },
    })

    expect(create.statusCode).toBe(201)
    const createdPane = create.json().pane
    expect(createdPane).toEqual(expect.objectContaining({
      id: expect.stringMatching(/^pane-/),
      name: 'Bael - backend API',
      agent: 'codex',
      workdir: 'packages/server',
      task: 'Implement Pane REST routes',
      mission: expect.objectContaining({
        name: 'hub-agent-team-mission-mvp',
        role: 'mission-agent',
        agentName: 'Bael',
      }),
      restore: 'manual',
      isolation: 'shared',
      yolo: true,
    }))
    expect(workspaceManager.getPanes()).toHaveLength(1)

    const configPath = path.join(projectDir, '.nexus', 'config.yaml')
    const savedAfterCreate = yaml.load(fs.readFileSync(configPath, 'utf8')) as { panes: Array<{ id: string; mission?: { name: string } }> }
    expect(savedAfterCreate.panes).toEqual([
      expect.objectContaining({
        id: createdPane.id,
        mission: expect.objectContaining({ name: 'hub-agent-team-mission-mvp' }),
      }),
    ])

    const filtered = await fastify.inject({ method: 'GET', url: '/api/panes?mission=hub-agent-team-mission-mvp' })
    expect(filtered.statusCode).toBe(200)
    expect(filtered.json().panes.map((pane: { id: string }) => pane.id)).toEqual([createdPane.id])

    const otherMission = await fastify.inject({ method: 'GET', url: '/api/panes?mission=other' })
    expect(otherMission.statusCode).toBe(200)
    expect(otherMission.json().panes).toEqual([])

    const close = await fastify.inject({ method: 'DELETE', url: `/api/panes/${createdPane.id}` })
    expect(close.statusCode).toBe(200)
    expect(close.json()).toEqual({ ok: true })
    expect(workspaceManager.getPanes()).toEqual([])
    const savedAfterClose = yaml.load(fs.readFileSync(configPath, 'utf8')) as { panes: unknown[] }
    expect(savedAfterClose.panes).toEqual([])

    const missing = await fastify.inject({ method: 'DELETE', url: `/api/panes/${createdPane.id}` })
    expect(missing.statusCode).toBe(404)
    expect(missing.json().error).toMatch(/Pane not found/)

    await fastify.close()
  })

  it('returns a validation error for unknown agents', async () => {
    const projectDir = makeTempProject('nexus-pane-routes-')
    useTempGlobalConfig(projectDir)
    const configManager = new ConfigManager(projectDir)
    const workspaceManager = new WorkspaceManager(configManager)
    await workspaceManager.init()
    const fastify = Fastify()
    registerPaneRoutes(fastify, workspaceManager, configManager)

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/panes',
      payload: { name: 'Unknown', agent: 'not-a-real-agent', restore: 'manual' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toMatch(/Unknown agent/)
    expect(workspaceManager.getPanes()).toEqual([])
    await fastify.close()
  })

  it('keeps Pane lifecycle routes out of the Hub server', async () => {
    const projectDir = makeTempProject('nexus-pane-routes-hub-')
    useTempGlobalConfig(projectDir)
    previousCwd = process.cwd()
    process.chdir(projectDir)
    const fastify = await buildHubServer(path.join(projectDir, 'fake-cli.mjs'))

    const list = await fastify.inject({ method: 'GET', url: '/api/panes' })
    const create = await fastify.inject({
      method: 'POST',
      url: '/api/panes',
      payload: { name: 'Should not exist', agent: 'codex', restore: 'manual' },
    })

    expect(list.headers['content-type']).not.toContain('application/json')
    expect(list.body).not.toContain('"panes"')
    expect(create.headers['content-type']).not.toContain('application/json')
    expect(create.body).not.toContain('"pane"')
    await fastify.close()
  })
})
