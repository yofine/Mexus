import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import yaml from 'js-yaml'
import { afterEach, describe, expect, it } from 'vitest'
import { ConfigManager } from '../workspace/ConfigManager.ts'
import type { PaneCreateConfig } from '../types.ts'
import { MissionService, resolveMissionTemplatePaths } from './MissionService.ts'

const repoRoot = path.resolve(__dirname, '../../../..')

function makeTempProject(): string {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-mission-'))
  fs.mkdirSync(path.join(projectDir, '.claude', 'skills'), { recursive: true })
  fs.cpSync(
    path.join(repoRoot, '.claude', 'skills', 'agent-team-mission-workflow'),
    path.join(projectDir, '.claude', 'skills', 'agent-team-mission-workflow'),
    { recursive: true },
  )
  return projectDir
}

function read(projectDir: string, rel: string): string {
  return fs.readFileSync(path.join(projectDir, rel), 'utf-8')
}

const tempProjects: string[] = []
const tempGlobalConfigDirs: string[] = []
let previousGlobalConfigDir: string | undefined

afterEach(() => {
  for (const project of tempProjects.splice(0)) {
    fs.rmSync(project, { recursive: true, force: true })
  }
  for (const dir of tempGlobalConfigDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  if (previousGlobalConfigDir === undefined) delete process.env.NEXUS_GLOBAL_CONFIG_DIR
  else process.env.NEXUS_GLOBAL_CONFIG_DIR = previousGlobalConfigDir
  previousGlobalConfigDir = undefined
})

function useTempGlobalConfigDir(): void {
  previousGlobalConfigDir = process.env.NEXUS_GLOBAL_CONFIG_DIR
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-mission-global-'))
  tempGlobalConfigDirs.push(dir)
  process.env.NEXUS_GLOBAL_CONFIG_DIR = dir
}

describe('Mission template resolution', () => {
  it('resolves templates from the project Skill references directory', () => {
    const projectDir = makeTempProject()
    tempProjects.push(projectDir)

    const paths = resolveMissionTemplatePaths(projectDir)

    expect(Object.keys(paths).sort()).toEqual([
      'agentRoster',
      'agents',
      'kanban',
      'mission',
      'missionWorkflow',
      'roundtable',
      'squadLead',
    ])
    expect(paths.missionWorkflow).toBe(path.join(projectDir, '.claude/skills/agent-team-mission-workflow/references/mission-workflow.md'))
  })

  it('throws an explicit user-readable error when a Skill template is missing', () => {
    const projectDir = makeTempProject()
    tempProjects.push(projectDir)
    fs.rmSync(path.join(projectDir, '.claude/skills/agent-team-mission-workflow/references/kanban-template.md'))

    expect(() => resolveMissionTemplatePaths(projectDir)).toThrow(/Missing Mission template: kanban-template\.md/)
  })
})

describe('MissionService lifecycle', () => {
  it('discovers existing on-disk Missions that were not created through MissionService', () => {
    const projectDir = makeTempProject()
    tempProjects.push(projectDir)
    fs.mkdirSync(path.join(projectDir, 'agent-team/missions/legacy-mission'), { recursive: true })
    fs.writeFileSync(path.join(projectDir, 'agent-team/missions/legacy-mission/mission.md'), [
      '# Mission: Legacy Mission',
      '',
      'Mission: `legacy-mission`',
      '',
      'Lifecycle: active',
      '',
      'Created by: Squad Lead',
      '',
    ].join('\n'))
    fs.mkdirSync(path.join(projectDir, 'agent-team/missions/not-a-mission'), { recursive: true })

    const service = new MissionService(projectDir, new ConfigManager(projectDir))

    expect(service.listMissions()).toEqual([
      expect.objectContaining({
        name: 'legacy-mission',
        lifecycle: 'active',
        complete: false,
        missingFiles: ['agents.md', 'kanban.md', 'roundtable.md', 'squad-lead.md'],
      }),
    ])
  })

  it('creates complete Mission files and makes the first Mission active', async () => {
    const projectDir = makeTempProject()
    tempProjects.push(projectDir)
    const service = new MissionService(projectDir, new ConfigManager(projectDir))

    const mission = await service.createMission({
      name: 'alpha-mission',
      originalRequest: 'Build the alpha backend.',
      activate: true,
    })

    expect(mission.summary).toEqual(expect.objectContaining({
      name: 'alpha-mission',
      lifecycle: 'active',
      complete: true,
    }))
    expect(read(projectDir, 'agent-team/mission-workflow.md')).toContain('# Mission Workflow')
    expect(read(projectDir, 'agent-team/agents.md')).toContain('# Agent Roster')
    expect(read(projectDir, 'agent-team/missions/alpha-mission/mission.md')).toContain('Lifecycle: active')
    expect(read(projectDir, 'agent-team/missions/alpha-mission/mission.md')).toContain('Build the alpha backend.')
    expect(read(projectDir, 'agent-team/missions/alpha-mission/kanban.md')).toContain('Mission: `alpha-mission`')

    const config = yaml.load(read(projectDir, '.nexus/config.yaml')) as { active_mission?: string }
    expect(config.active_mission).toBe('alpha-mission')
  })

  it('creates a Squad Lead pane with the Mission default CLI agent during Mission creation', async () => {
    useTempGlobalConfigDir()
    const projectDir = makeTempProject()
    tempProjects.push(projectDir)
    const configManager = new ConfigManager(projectDir)
    configManager.updateGlobalConfig({
      ...configManager.loadGlobalConfig(),
      mission_defaults: {
        agent_type: 'codex',
      },
    })
    const createdPanes: PaneCreateConfig[] = []
    const service = new MissionService(projectDir, configManager, {
      createPane: async (config) => {
        createdPanes.push(config)
        return { id: 'pane-1' }
      },
    })

    const mission = await service.createMission({
      name: 'pane-mission',
      goal: 'Coordinate the pane mission.',
      activate: true,
    })

    expect(mission.summary.name).toBe('pane-mission')
    expect(read(projectDir, 'agent-team/missions/pane-mission/mission.md')).toContain('Coordinate the pane mission.')
    expect(createdPanes).toHaveLength(1)
    expect(createdPanes[0]).toEqual(expect.objectContaining({
      name: 'Squad Lead - pane-mission',
      agent: 'codex',
      workdir: '.',
      restore: 'manual',
      isolation: 'shared',
      yolo: false,
      mission: {
        name: 'pane-mission',
        path: 'agent-team/missions/pane-mission',
        role: 'squad-lead',
        agentName: 'Squad Lead',
      },
    }))
    expect(createdPanes[0].task).toContain('Use the agent-team-mission-workflow skill.')
    expect(createdPanes[0].task).toContain('agent-team/missions/pane-mission/squad-lead.md')
    expect(createdPanes[0].task).toContain('Do not implement product code unless the user explicitly asks.')
  })

  it('enforces one active Mission during create and activate operations', async () => {
    const projectDir = makeTempProject()
    tempProjects.push(projectDir)
    const service = new MissionService(projectDir, new ConfigManager(projectDir))

    await service.createMission({ name: 'first', activate: true })
    await service.createMission({ name: 'draft', activate: false })
    expect(service.getMission('first').summary.lifecycle).toBe('active')
    expect(service.getMission('draft').summary.lifecycle).toBe('inactive')

    await service.createMission({ name: 'second', activate: true })
    expect(service.getMission('first').summary.lifecycle).toBe('inactive')
    expect(service.getMission('second').summary.lifecycle).toBe('active')

    service.activateMission('draft')
    expect(service.getMission('draft').summary.lifecycle).toBe('active')
    expect(service.getMission('second').summary.lifecycle).toBe('inactive')
    expect(service.getActiveMission()?.summary.name).toBe('draft')
  })

  it('discovers incomplete Missions and repairs only missing files from templates', async () => {
    const projectDir = makeTempProject()
    tempProjects.push(projectDir)
    const service = new MissionService(projectDir, new ConfigManager(projectDir))

    await service.createMission({ name: 'repairable', activate: true })
    const kanbanPath = path.join(projectDir, 'agent-team/missions/repairable/kanban.md')
    fs.writeFileSync(kanbanPath, `${read(projectDir, 'agent-team/missions/repairable/kanban.md')}\nmanual note\n`)
    fs.rmSync(path.join(projectDir, 'agent-team/missions/repairable/roundtable.md'))

    expect(service.listMissions()[0]).toEqual(expect.objectContaining({ name: 'repairable', complete: false }))

    service.repairMission('repairable')

    expect(read(projectDir, 'agent-team/missions/repairable/kanban.md')).toContain('manual note')
    expect(read(projectDir, 'agent-team/missions/repairable/roundtable.md')).toContain('Mission: `repairable`')
    expect(service.getMission('repairable').summary.complete).toBe(true)
  })

  it('returns raw file fallbacks when parsing is partial', async () => {
    const projectDir = makeTempProject()
    tempProjects.push(projectDir)
    const service = new MissionService(projectDir, new ConfigManager(projectDir))

    await service.createMission({ name: 'raw-fallback', activate: true })
    fs.writeFileSync(path.join(projectDir, 'agent-team/missions/raw-fallback/kanban.md'), 'not a kanban')

    const mission = service.getMission('raw-fallback')

    expect(mission.files.kanban.raw).toBe('not a kanban')
    expect(mission.files.kanban.parseError).toMatch(/Kanban sections/)
    expect(mission.kanban).toEqual({ toClaim: [], inProgress: [], done: [] })
  })

  it('rejects Mission names that could escape the workspace path', async () => {
    const projectDir = makeTempProject()
    tempProjects.push(projectDir)
    const service = new MissionService(projectDir, new ConfigManager(projectDir))

    await expect(service.createMission({ name: '../escape', activate: true })).rejects.toThrow(/Invalid Mission name/)
    expect(() => service.getMission('nested/path')).toThrow(/Invalid Mission name/)
  })
})
