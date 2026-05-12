import { describe, expect, it } from 'vitest'
import type { PaneState } from '../types'
import { useWorkspaceStore } from './workspaceStore'

function pane(id: string, overrides: Partial<PaneState> = {}): PaneState {
  return {
    id,
    name: id,
    agent: 'claudecode',
    restore: 'restart',
    isolation: 'shared',
    runtime: 'pty',
    status: 'idle',
    meta: {},
    ...overrides,
  }
}

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

describe('workspaceStore active pane', () => {
  it('does not auto-select the first pane when workspace state loads', () => {
    useWorkspaceStore.getState().resetWorkspace()

    useWorkspaceStore.getState().setWorkspace('Nexus', '', '/repo', [
      pane('pane-1'),
      pane('pane-2'),
    ])

    expect(useWorkspaceStore.getState().activePaneId).toBeNull()
  })

  it('does not auto-select another pane after removing the active pane', () => {
    useWorkspaceStore.getState().resetWorkspace()
    useWorkspaceStore.getState().setWorkspace('Nexus', '', '/repo', [
      pane('pane-1'),
      pane('pane-2'),
    ])
    useWorkspaceStore.getState().setActivePaneId('pane-1')

    useWorkspaceStore.getState().removePane('pane-1')

    expect(useWorkspaceStore.getState().activePaneId).toBeNull()
  })
})
