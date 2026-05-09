import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import yaml from 'js-yaml'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfigManager } from '../workspace/ConfigManager.ts'
import type { PaneCreateConfig, PaneState } from '../types.ts'
import { MissionArchiveBlockedError, MissionService, resolveMissionTemplatePaths } from './MissionService.ts'

const repoRoot = path.resolve(__dirname, '../../../..')

function makeTempProject(): string {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-mission-'))
  fs.mkdirSync(path.join(projectDir, '.claude', 'skills'), { recursive: true })
  fs.cpSync(
    path.join(repoRoot, '.claude', 'skills', 'agent-team-mission-workflow'),
    path.join(projectDir, '.claude', 'skills', 'agent-team-mission-workflow'),
    { recursive: true },
  )
  const pluginReferencesDir = path.join(repoRoot, 'packages/plugin-agent-team/references')
  const skillReferencesDir = path.join(projectDir, '.claude/skills/agent-team-mission-workflow/references')
  if (fs.existsSync(pluginReferencesDir)) {
    fs.mkdirSync(skillReferencesDir, { recursive: true })
    for (const filename of fs.readdirSync(pluginReferencesDir)) {
      fs.copyFileSync(path.join(pluginReferencesDir, filename), path.join(skillReferencesDir, filename))
    }
  }
  return projectDir
}

function read(projectDir: string, rel: string): string {
  return fs.readFileSync(path.join(projectDir, rel), 'utf-8')
}

function pane(overrides: Partial<PaneState>): PaneState {
  return {
    id: 'pane-1',
    name: 'Pane',
    agent: 'codex',
    restore: 'manual',
    isolation: 'shared',
    yolo: false,
    runtime: 'pty',
    status: 'idle',
    meta: {},
    ...overrides,
  }
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

  it('falls back to plugin references when Mission file templates are not present in the Skill references directory', () => {
    const projectDir = makeTempProject()
    tempProjects.push(projectDir)
    const skillReferencesDir = path.join(projectDir, '.claude/skills/agent-team-mission-workflow/references')
    const pluginReferencesDir = path.join(projectDir, 'packages/plugin-agent-team/references')
    fs.mkdirSync(pluginReferencesDir, { recursive: true })
    for (const filename of [
      'mission-workflow.md',
      'mission-template.md',
      'agents-template.md',
      'kanban-template.md',
      'roundtable-template.md',
      'squad-lead-template.md',
    ]) {
      fs.renameSync(path.join(skillReferencesDir, filename), path.join(pluginReferencesDir, filename))
    }

    const paths = resolveMissionTemplatePaths(projectDir)

    expect(paths.mission).toBe(path.join(pluginReferencesDir, 'mission-template.md'))
    expect(paths.kanban).toBe(path.join(pluginReferencesDir, 'kanban-template.md'))
    expect(paths.agentRoster).toBe(path.join(skillReferencesDir, 'agent-roster-template.md'))
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

  it('archives a Mission by moving its directory under _archived', async () => {
    const projectDir = makeTempProject()
    tempProjects.push(projectDir)
    const service = new MissionService(projectDir, new ConfigManager(projectDir))
    await service.createMission({ name: 'active-baseline', activate: true })
    await service.createMission({ name: 'archive-me', activate: false })

    const result = await service.archiveMission('archive-me', { force: false })

    expect(result).toEqual({
      name: 'archive-me',
      path: 'agent-team/missions/_archived/archive-me',
      closedPaneIds: [],
      deactivated: false,
    })
    expect(fs.existsSync(path.join(projectDir, 'agent-team/missions/archive-me'))).toBe(false)
    expect(fs.existsSync(path.join(projectDir, 'agent-team/missions/_archived/archive-me/mission.md'))).toBe(true)
    expect(service.listMissions().map((mission) => mission.name)).not.toContain('archive-me')
  })

  it('deactivates the archived active Mission in workspace config', async () => {
    const projectDir = makeTempProject()
    tempProjects.push(projectDir)
    const configManager = new ConfigManager(projectDir)
    const service = new MissionService(projectDir, configManager)
    await service.createMission({ name: 'active-archive', activate: true })

    const result = await service.archiveMission('active-archive', { force: false })

    expect(result.deactivated).toBe(true)
    const config = yaml.load(read(projectDir, '.nexus/config.yaml')) as { active_mission?: string | null }
    expect(config.active_mission).toBeNull()
  })

  it('blocks archive when Mission panes are running and force is false', async () => {
    useTempGlobalConfigDir()
    const projectDir = makeTempProject()
    tempProjects.push(projectDir)
    const configManager = new ConfigManager(projectDir)
    const panes = [
      pane({
        id: 'pane-running',
        status: 'running',
        mission: {
          name: 'blocked-mission',
          path: 'agent-team/missions/blocked-mission',
          role: 'mission-agent',
          agentName: 'Bael',
        },
      }),
    ]
    const closePane = vi.fn()
    const service = new MissionService(projectDir, configManager, {
      createPane: vi.fn(),
      getPanes: () => panes,
      closePane,
    })
    await service.createMission({ name: 'blocked-mission', activate: false })

    await expect(service.archiveMission('blocked-mission', { force: false })).rejects.toThrow(MissionArchiveBlockedError)
    expect(closePane).not.toHaveBeenCalled()
    expect(fs.existsSync(path.join(projectDir, 'agent-team/missions/blocked-mission'))).toBe(true)
  })

  it('force archives and closes all panes belonging to the Mission', async () => {
    useTempGlobalConfigDir()
    const projectDir = makeTempProject()
    tempProjects.push(projectDir)
    const configManager = new ConfigManager(projectDir)
    const panes = [
      pane({
        id: 'pane-running',
        status: 'running',
        mission: {
          name: 'force-mission',
          path: 'agent-team/missions/force-mission',
          role: 'mission-agent',
          agentName: 'Bael',
        },
      }),
      pane({
        id: 'pane-idle',
        status: 'idle',
        mission: {
          name: 'force-mission',
          path: 'agent-team/missions/force-mission',
          role: 'squad-lead',
          agentName: 'Squad Lead',
        },
      }),
      pane({ id: 'pane-other', mission: { name: 'other', path: 'agent-team/missions/other', role: 'mission-agent', agentName: 'Other' } }),
    ]
    const closePane = vi.fn(async (id: string) => {
      const index = panes.findIndex((candidate) => candidate.id === id)
      if (index >= 0) panes.splice(index, 1)
    })
    const service = new MissionService(projectDir, configManager, {
      createPane: vi.fn(),
      getPanes: () => panes,
      closePane,
    })
    await service.createMission({ name: 'force-mission', activate: false })

    const result = await service.archiveMission('force-mission', { force: true })

    expect(result.closedPaneIds.sort()).toEqual(['pane-idle', 'pane-running'])
    expect(closePane).toHaveBeenCalledTimes(2)
    expect(panes.map((candidate) => candidate.id)).toEqual(['pane-other'])
    expect(fs.existsSync(path.join(projectDir, 'agent-team/missions/_archived/force-mission'))).toBe(true)
  })
})
