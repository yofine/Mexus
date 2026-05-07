import { describe, expect, it } from 'vitest'
import { useWorkspaceStore } from './workspaceStore'

describe('workspaceStore editor tabs', () => {
  it('starts with a pinned Team tab between Activity and Review', () => {
    useWorkspaceStore.getState().resetWorkspace()

    expect(useWorkspaceStore.getState().tabs.map((tab) => [tab.id, tab.type, tab.label, tab.pinned])).toEqual([
      ['tab:activity', 'activity', 'Activity', true],
      ['tab:team', 'team', 'Team', true],
      ['review:workspace', 'review', 'Review', true],
    ])
  })

  it('does not close the pinned Team tab', () => {
    useWorkspaceStore.getState().resetWorkspace()

    useWorkspaceStore.getState().closeTab('tab:team')

    expect(useWorkspaceStore.getState().tabs.some((tab) => tab.id === 'tab:team')).toBe(true)
  })
})
