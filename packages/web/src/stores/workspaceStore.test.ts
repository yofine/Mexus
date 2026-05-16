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
  it('starts with pinned observer tabs including Replay after Review', () => {
    useWorkspaceStore.getState().resetWorkspace()

    expect(useWorkspaceStore.getState().tabs.map((tab) => [tab.id, tab.type, tab.label, tab.pinned])).toEqual([
      ['tab:activity', 'activity', 'Activity', true],
      ['tab:team', 'team', 'Team', true],
      ['review:workspace', 'review', 'Review', true],
      ['tab:replay', 'replay', 'Replay', true],
    ])
  })

  it('does not close the pinned Team tab', () => {
    useWorkspaceStore.getState().resetWorkspace()

    useWorkspaceStore.getState().closeTab('tab:team')

    expect(useWorkspaceStore.getState().tabs.some((tab) => tab.id === 'tab:team')).toBe(true)
  })

  it('keeps the pinned Replay tab as the workspace-level replay action target', () => {
    useWorkspaceStore.getState().resetWorkspace()

    useWorkspaceStore.getState().openReplayTab()

    const state = useWorkspaceStore.getState()
    expect(state.activeTabId).toBe('tab:replay')
    expect(state.tabs.find((tab) => tab.id === 'tab:replay')).toMatchObject({
      type: 'replay',
      label: 'Replay',
      pinned: true,
    })
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

describe('workspaceStore renamePane', () => {
  it('renames a shell pane in shellPanes without touching panes', () => {
    useWorkspaceStore.getState().resetWorkspace()
    useWorkspaceStore.getState().setWorkspace('Nexus', '', '/repo', [
      pane('pane-1'),
      pane('__shell__:1', { name: 'Shell 1', agent: '__shell__' }),
    ])

    useWorkspaceStore.getState().renamePane('__shell__:1', 'Build runner')

    const state = useWorkspaceStore.getState()
    expect(state.shellPanes.find((p) => p.id === '__shell__:1')?.name).toBe('Build runner')
    expect(state.panes.find((p) => p.id === 'pane-1')?.name).toBe('pane-1')
  })

  it('still renames agent panes via panes list', () => {
    useWorkspaceStore.getState().resetWorkspace()
    useWorkspaceStore.getState().setWorkspace('Nexus', '', '/repo', [
      pane('pane-1'),
    ])

    useWorkspaceStore.getState().renamePane('pane-1', 'Renamed')

    expect(useWorkspaceStore.getState().panes.find((p) => p.id === 'pane-1')?.name).toBe('Renamed')
  })
})
