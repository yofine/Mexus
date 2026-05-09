import { describe, expect, it } from 'vitest'
import type { MissionAgentObservation, MissionDetails } from '@/stores/missionStore'
import { buildMissionAgentPaneDefaults, buildPaneMission } from './AddPaneDialog'

describe('AddPaneDialog Mission defaults', () => {
  const mission = {
    name: 'hub-agent-team-mission-mvp',
    path: 'agent-team/missions/hub-agent-team-mission-mvp',
  } as MissionDetails

  const agent: MissionAgentObservation = {
    name: 'Marbas',
    responsibility: 'Mission-aware pane creation and observation.',
    activationPromptSummary: 'Read the Mission files and claim assigned work.',
    initialPromptSummary: 'Prioritize work assigned to To: Marbas.',
    taskCounts: {
      toClaim: 1,
      inProgress: 0,
      done: 0,
      total: 1,
    },
  }

  it('builds pane name, task, and mission metadata from an active Mission Agent', () => {
    expect(buildMissionAgentPaneDefaults(mission, agent)).toMatchObject({
      name: 'Marbas - hub-agent-team-mission-mvp',
      task: expect.stringContaining('You are Marbas, a Mission Agent for mission `hub-agent-team-mission-mvp`.'),
    })

    expect(buildPaneMission(mission, agent)).toEqual({
      name: 'hub-agent-team-mission-mvp',
      path: 'agent-team/missions/hub-agent-team-mission-mvp',
      role: 'mission-agent',
      agentName: 'Marbas',
    })
  })

  it('uses the default Mission path when details omit an explicit path', () => {
    const missionWithoutPath = { name: 'mission-alpha' } as MissionDetails

    expect(buildPaneMission(missionWithoutPath, agent)?.path).toBe('agent-team/missions/mission-alpha')
    expect(buildMissionAgentPaneDefaults(missionWithoutPath, agent).task).toContain('- agent-team/missions/mission-alpha/kanban.md')
  })
})
