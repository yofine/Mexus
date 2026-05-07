import type { PaneState } from '@/types'

export function getHubPaneFilterOptions(panes: PaneState[]): { missions: string[]; agents: string[] } {
  return {
    missions: Array.from(new Set(panes.map((pane) => pane.mission?.name).filter(Boolean) as string[])).sort(),
    agents: Array.from(new Set(panes.map((pane) => pane.agent).filter((agent) => agent !== '__shell__'))).sort(),
  }
}

export function filterHubPanes(panes: PaneState[], missionFilter: string, agentFilter: string): PaneState[] {
  return panes.filter((pane) => {
    const missionMatch =
      missionFilter === 'all' ||
      (missionFilter === '__none__' ? !pane.mission : pane.mission?.name === missionFilter)
    const agentMatch = agentFilter === 'all' || pane.agent === agentFilter
    return missionMatch && agentMatch
  })
}
