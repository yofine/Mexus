import { describe, expect, it } from 'vitest'
import type { PaneState } from '@/types'
import { filterHubPanes, getHubPaneFilterOptions } from './hubPaneFilters'

function pane(id: string, agent: PaneState['agent'], missionName?: string): PaneState {
  return {
    id,
    name: id,
    agent,
    mission: missionName ? { name: missionName, path: `agent-team/missions/${missionName}`, role: 'mission-agent', agentName: id } : undefined,
    restore: 'restart',
    isolation: 'shared',
    status: 'running',
    runtime: 'pty',
    meta: {},
  }
}

describe('Hub pane filters', () => {
  const panes = [
    pane('marbas', 'codex', 'mission-a'),
    pane('bael', 'claudecode', 'mission-b'),
    pane('scratch', 'opencode'),
    pane('__shell__-1', '__shell__'),
  ]

  it('filters by mission and agent type without mutating panes', () => {
    expect(filterHubPanes(panes, 'mission-a', 'codex').map((item) => item.id)).toEqual(['marbas'])
    expect(filterHubPanes(panes, '__none__', 'all').map((item) => item.id)).toEqual(['scratch', '__shell__-1'])
    expect(panes).toHaveLength(4)
  })

  it('builds Mission and configured agent type filter options', () => {
    expect(getHubPaneFilterOptions(panes)).toEqual({
      missions: ['mission-a', 'mission-b'],
      agents: ['claudecode', 'codex', 'opencode'],
    })
  })
})
