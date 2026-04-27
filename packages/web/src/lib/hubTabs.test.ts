import { describe, expect, it } from 'vitest'
import type { HubInstanceRecord } from '@/types'
import {
  buildHubTabSnapshot,
  createHubTab,
  formatShortPath,
  restoreHubTabs,
} from './hubTabs'

function instance(overrides: Partial<HubInstanceRecord> = {}): HubInstanceRecord {
  return {
    pid: 123,
    port: 7700,
    cwd: '/root/workspace/Nexus',
    projectName: 'Nexus',
    startedAt: 1,
    status: 'running',
    ...overrides,
  }
}

describe('hubTabs', () => {
  it('restores only tabs with matching server records', () => {
    const restored = restoreHubTabs({
      saved: {
        openServerIds: ['local:7700', 'local:7799'],
        activeTabId: 'tab:local:7799',
        connectedTabId: 'tab:local:7700',
        settingsTabOpen: false,
      },
      instances: [instance()],
      dashboardTabId: 'hub:dashboard',
      settingsTabId: 'hub:settings',
    })

    expect(restored.tabs).toEqual([createHubTab(instance())])
    expect(restored.activeTabId).toBe('hub:dashboard')
    expect(restored.connectedTabId).toBe('tab:local:7700')
  })

  it('does not restore a connected tab for a stopped server', () => {
    const restored = restoreHubTabs({
      saved: {
        openServerIds: ['local:7701'],
        activeTabId: 'tab:local:7701',
        connectedTabId: 'tab:local:7701',
        settingsTabOpen: false,
      },
      instances: [instance({ port: 7701, status: 'stopped' })],
      dashboardTabId: 'hub:dashboard',
      settingsTabId: 'hub:settings',
    })

    expect(restored.activeTabId).toBe('tab:local:7701')
    expect(restored.connectedTabId).toBeNull()
  })

  it('formats short cwd labels for tab compact display', () => {
    expect(formatShortPath('/root/workspace/Nexus')).toBe('workspace/Nexus')
    expect(formatShortPath('/Nexus')).toBe('/Nexus')
  })

  it('builds snapshots from current instance data', () => {
    expect(buildHubTabSnapshot(instance())).toEqual({
      projectName: 'Nexus',
      port: 7700,
      cwd: '/root/workspace/Nexus',
      status: 'running',
      pid: 123,
    })
  })
})
