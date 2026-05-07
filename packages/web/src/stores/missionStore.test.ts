import { afterEach, describe, expect, it, vi } from 'vitest'
import { useConnectionStore } from './connectionStore'
import { parseMissionAgents, parseMissionKanban, parseMissionOverview, useMissionStore } from './missionStore'

const kanbanMarkdown = `# Agent Team Kanban

## To Claim

To: Samigina | From: Squad Lead | Scope: \`packages/web/src/components/missions/MissionKanban.tsx\`
- Ref: 3b7c1aa
- Request: Build read-only Mission Kanban parsing and rendering.
- Reason: Kanban is the core observation surface.
- Acceptance: Parser failures show raw fallback.
- Result:
- Files:
- Verification:
- Review:
- Updated: 2026-05-06, Squad Lead

## In Progress

To: Vassago | From: Squad Lead | Scope: \`packages/web/src/stores/missionStore.ts\`
- Ref: 18c2b6a
- Request: Build missionStore.
- Reason: Team tab needs Mission state.
- Acceptance: Refreshing Mission data does not reset editor tabs.
- Result:
- Files:
- Verification:
- Review:
- Updated: 2026-05-06, Vassago

## Done

To: Bael | From: Squad Lead | Scope: \`packages/server/src/mission/MissionService.ts\`
- Ref: c9e6f24
- Request: Build MissionService.
- Reason: Team tab needs backend state.
- Acceptance: Active Mission is enforced.
- Result: Implemented service.
- Files: packages/server/src/mission/MissionService.ts
- Verification: pnpm test
- Review:
- Updated: 2026-05-06, Bael
`

const agentsMarkdown = `# Mission Agents

| Agent Name | Responsibility |
| --- | --- |
| \`Samigina\` | Read-only Kanban, Mission Agent observation, Markdown parsers, and parser fallback. |
| \`Vassago\` | Hub Team tab, Mission store, Mission selector, and overview UI. |

## Agent: Samigina

Owner label: \`Samigina\`

Responsibility: Read-only Kanban, Mission Agent observation, Markdown parsers, and fallback behavior.

Activation prompt:

\`\`\`text
You are Samigina, the agent responsible for read-only Kanban.
First read mission files and then claim a task assigned to To: Samigina.
\`\`\`

Initial prompt:

\`\`\`text
Goal: Build read-only Mission observation components and parsers.

Acceptance:
- Kanban parses To Claim, In Progress, and Done.
\`\`\`

## Agent: Vassago

Owner label: \`Vassago\`

Responsibility: Hub Team tab, Mission store, Mission selector, and overview UI.
`

afterEach(() => {
  vi.unstubAllGlobals()
  useConnectionStore.getState().setActiveTarget(null)
})

describe('mission parsers', () => {
  it('parses mission overview fields from mission.md', () => {
    const result = parseMissionOverview(`# Mission: Hub Agent Team Mission MVP

Mission: \`hub-agent-team-mission-mvp\`

Lifecycle: active

Date: 2026-05-06

## Mission Intent

Integrate Agent Team Mission Workflow into Mexus Hub connected workspace view.

## Minimum Acceptance Standard

- Hub Team tab can display Mission data.
- Markdown stays the source of truth.
`)

    expect(result.name).toBe('hub-agent-team-mission-mvp')
    expect(result.lifecycle).toBe('active')
    expect(result.date).toBe('2026-05-06')
    expect(result.intent).toBe('Integrate Agent Team Mission Workflow into Mexus Hub connected workspace view.')
    expect(result.acceptance).toEqual([
      'Hub Team tab can display Mission data.',
      'Markdown stays the source of truth.',
    ])
  })

  it('parses To Claim, In Progress, and Done kanban task blocks', () => {
    const result = parseMissionKanban(kanbanMarkdown)

    expect(result.ok).toBe(true)
    expect(result.raw).toBe(kanbanMarkdown)
    expect(result.tasks.map((task) => [task.status, task.to, task.ref])).toEqual([
      ['To Claim', 'Samigina', '3b7c1aa'],
      ['In Progress', 'Vassago', '18c2b6a'],
      ['Done', 'Bael', 'c9e6f24'],
    ])
    expect(result.counts).toEqual({ toClaim: 1, inProgress: 1, done: 1, unreviewedDone: 1 })
  })

  it('returns a raw fallback when kanban markdown cannot be parsed', () => {
    const result = parseMissionKanban('No kanban headings here')

    expect(result.ok).toBe(false)
    expect(result.tasks).toEqual([])
    expect(result.raw).toBe('No kanban headings here')
    expect(result.error).toMatch(/status/i)
  })

  it('reports source lines for duplicate task blocks independently', () => {
    const duplicateTask = `To: Samigina | From: Squad Lead | Scope: \`packages/web/src/stores/missionStore.ts\`
- Ref: duplicate
- Request: Verify line numbers.
- Reason: Duplicate text can appear in different status sections.
- Acceptance: Each card opens its own source location.
- Result:
- Files:
- Verification:
- Review:
- Updated: 2026-05-08, Samigina`
    const markdown = `# Agent Team Kanban

## To Claim

${duplicateTask}

## In Progress

${duplicateTask}

## Done

To: Bael | From: Squad Lead | Scope: \`packages/server/src/mission/MissionService.ts\`
- Ref: done
- Request: Done task.
- Reason: Required section.
- Acceptance: Done parses.
- Result:
- Files:
- Verification:
- Review:
- Updated: 2026-05-08, Bael
`

    const result = parseMissionKanban(markdown)

    expect(result.ok).toBe(true)
    expect(result.tasks.map((task) => [task.status, task.line])).toEqual([
      ['To Claim', 5],
      ['In Progress', 18],
      ['Done', 31],
    ])
  })

  it('parses mission agents and derives task counts from kanban To values', () => {
    const kanban = parseMissionKanban(kanbanMarkdown)
    const result = parseMissionAgents(agentsMarkdown, kanban.tasks)

    expect(result.ok).toBe(true)
    expect(result.agents).toEqual([
      expect.objectContaining({
        name: 'Samigina',
        responsibility: 'Read-only Kanban, Mission Agent observation, Markdown parsers, and fallback behavior.',
        activationPromptSummary: 'You are Samigina, the agent responsible for read-only Kanban. First read mission files and then claim a task assigned to To: Samigina.',
        initialPromptSummary: 'Goal: Build read-only Mission observation components and parsers. Acceptance: - Kanban parses To Claim, In Progress, and Done.',
        taskCounts: { toClaim: 1, inProgress: 0, done: 0, total: 1 },
      }),
      expect.objectContaining({
        name: 'Vassago',
        responsibility: 'Hub Team tab, Mission store, Mission selector, and overview UI.',
        taskCounts: { toClaim: 0, inProgress: 1, done: 0, total: 1 },
      }),
    ])
  })

  it('loads live MissionDetail payloads into overview, kanban, agents, and incomplete state', async () => {
    useConnectionStore.getState().setActiveTarget({
      serverId: 'test',
      label: 'Test',
      httpBaseUrl: 'http://test.local',
      wsBaseUrl: 'ws://test.local',
    })
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        summary: {
          name: 'hub-agent-team-mission-mvp',
          path: 'agent-team/missions/hub-agent-team-mission-mvp',
          lifecycle: 'active',
          complete: true,
          missingFiles: [],
          taskCounts: { toClaim: 1, inProgress: 1, done: 1 },
          unreviewedDoneCount: 1,
        },
        files: {
          mission: { path: 'agent-team/missions/hub-agent-team-mission-mvp/mission.md', exists: true, raw: `# Mission

Mission: \`hub-agent-team-mission-mvp\`

Lifecycle: active

Date: 2026-05-06

## Mission Intent

Render Mission data from the live API.
` },
          agents: { path: 'agent-team/missions/hub-agent-team-mission-mvp/agents.md', exists: true, raw: agentsMarkdown },
          kanban: { path: 'agent-team/missions/hub-agent-team-mission-mvp/kanban.md', exists: true, raw: kanbanMarkdown },
          roundtable: { path: 'agent-team/missions/hub-agent-team-mission-mvp/roundtable.md', exists: true, raw: '' },
          squadLead: { path: 'agent-team/missions/hub-agent-team-mission-mvp/squad-lead.md', exists: true, raw: '' },
        },
        kanban: { toClaim: [], inProgress: [], done: [] },
      }),
    })))

    await useMissionStore.getState().loadMission('hub-agent-team-mission-mvp')

    const state = useMissionStore.getState()
    expect(state.selectedMission?.incomplete).toBe(false)
    expect(state.overview).toMatchObject({
      name: 'hub-agent-team-mission-mvp',
      lifecycle: 'active',
      intent: 'Render Mission data from the live API.',
    })
    expect(state.kanban?.ok).toBe(true)
    expect(state.kanban?.counts).toEqual({ toClaim: 1, inProgress: 1, done: 1, unreviewedDone: 1 })
    expect(state.agents?.ok).toBe(true)
    expect(state.agents?.agents.map((agent) => agent.name)).toEqual(['Samigina', 'Vassago'])
  })

  it('loads Mission details silently without toggling visible loading state', async () => {
    useConnectionStore.getState().setActiveTarget({
      serverId: 'test',
      label: 'Test',
      httpBaseUrl: 'http://test.local',
      wsBaseUrl: 'ws://test.local',
    })
    let resolveFetch: (value: Response) => void = () => {}
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })))
    useMissionStore.setState({ isLoading: false, error: 'previous error' })

    const promise = useMissionStore.getState().loadMission('silent-mission', { silent: true })

    expect(useMissionStore.getState().isLoading).toBe(false)
    expect(useMissionStore.getState().error).toBeNull()

    resolveFetch({
      ok: true,
      json: async () => ({
        summary: { name: 'silent-mission', lifecycle: 'active', complete: true, missingFiles: [] },
        files: {
          mission: { path: 'mission.md', exists: true, raw: 'Mission: `silent-mission`\nLifecycle: active\n' },
          kanban: { path: 'kanban.md', exists: true, raw: kanbanMarkdown },
          agents: { path: 'agents.md', exists: true, raw: agentsMarkdown },
        },
      }),
    } as Response)

    await promise

    expect(useMissionStore.getState().isLoading).toBe(false)
    expect(useMissionStore.getState().selectedMission?.name).toBe('silent-mission')
  })

  it('maps incomplete live MissionDetail payloads and surfaces kanban parse errors', async () => {
    useConnectionStore.getState().setActiveTarget({
      serverId: 'test',
      label: 'Test',
      httpBaseUrl: 'http://test.local',
      wsBaseUrl: 'ws://test.local',
    })
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        summary: {
          name: 'broken-mission',
          path: 'agent-team/missions/broken-mission',
          lifecycle: 'inactive',
          complete: false,
          missingFiles: ['agents.md'],
          taskCounts: { toClaim: 0, inProgress: 0, done: 0 },
          unreviewedDoneCount: 0,
        },
        files: {
          mission: { path: 'agent-team/missions/broken-mission/mission.md', exists: true, raw: 'Mission: `broken-mission`\nLifecycle: inactive\n' },
          agents: { path: 'agent-team/missions/broken-mission/agents.md', exists: false, raw: '' },
          kanban: { path: 'agent-team/missions/broken-mission/kanban.md', exists: true, raw: 'not a kanban', parseError: 'Kanban sections missing.' },
          roundtable: { path: 'agent-team/missions/broken-mission/roundtable.md', exists: true, raw: '' },
          squadLead: { path: 'agent-team/missions/broken-mission/squad-lead.md', exists: true, raw: '' },
        },
        kanban: { toClaim: [], inProgress: [], done: [] },
      }),
    })))

    await useMissionStore.getState().loadMission('broken-mission')

    const state = useMissionStore.getState()
    expect(state.selectedMission?.incomplete).toBe(true)
    expect(state.selectedMission?.missingFiles).toEqual(['agents.md'])
    expect(state.kanban).toMatchObject({
      ok: false,
      raw: 'not a kanban',
      error: 'Kanban sections missing.',
    })
  })
})
