import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildHubServer } from './index.ts'

const tempProjects: string[] = []
let previousCwd: string | undefined

function makeTempProject(): string {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-hub-missions-'))
  fs.mkdirSync(path.join(projectDir, 'agent-team/missions/hub-agent-team-mission-mvp'), { recursive: true })
  fs.writeFileSync(path.join(projectDir, 'agent-team/missions/hub-agent-team-mission-mvp/mission.md'), [
    '# Mission: Hub Agent Team Mission MVP',
    '',
    'Mission: `hub-agent-team-mission-mvp`',
    '',
    'Lifecycle: active',
    '',
  ].join('\n'))
  tempProjects.push(projectDir)
  return projectDir
}

afterEach(() => {
  if (previousCwd) {
    process.chdir(previousCwd)
    previousCwd = undefined
  }
  for (const project of tempProjects.splice(0)) {
    fs.rmSync(project, { recursive: true, force: true })
  }
})

describe('Hub Mission routes', () => {
  it('lists on-disk Missions from the Hub working directory', async () => {
    const projectDir = makeTempProject()
    previousCwd = process.cwd()
    process.chdir(projectDir)
    const fastify = await buildHubServer(path.join(projectDir, 'fake-cli.mjs'))

    const response = await fastify.inject({ method: 'GET', url: '/api/missions' })

    expect(response.statusCode).toBe(200)
    expect(response.json().missions).toEqual([
      expect.objectContaining({
        name: 'hub-agent-team-mission-mvp',
        lifecycle: 'active',
        complete: false,
      }),
    ])
    await fastify.close()
  })

  it('rejects bare Hub Mission creation because pane creation requires a workspace instance', async () => {
    const projectDir = makeTempProject()
    previousCwd = process.cwd()
    process.chdir(projectDir)
    const fastify = await buildHubServer(path.join(projectDir, 'fake-cli.mjs'))

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/missions',
      payload: { name: 'new-hub-mission' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toMatch(/Connect to a workspace instance to create Missions/)
    await fastify.close()
  })
})
