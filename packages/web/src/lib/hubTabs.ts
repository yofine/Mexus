import type { HubInstanceRecord } from '@/types'

export type HubTabSnapshot = Pick<HubInstanceRecord, 'projectName' | 'port' | 'cwd' | 'status' | 'pid'>

export type HubTab = {
  id: string
  serverId: string
  title: string
  snapshot: HubTabSnapshot
}

export type HubTabStorage = {
  openServerIds: string[]
  activeTabId: string
  connectedTabId: string | null
  settingsTabOpen: boolean
}

export const HUB_TAB_STORAGE_KEY = 'mexus.hub.tabs.v1'

export function serverIdFor(port: number): string {
  return `local:${port}`
}

export function tabIdForServerId(serverId: string): string {
  return `tab:${serverId}`
}

export function buildHubTabSnapshot(instance: HubInstanceRecord): HubTabSnapshot {
  return {
    projectName: instance.projectName,
    port: instance.port,
    cwd: instance.cwd,
    status: instance.status,
    pid: instance.pid,
  }
}

export function createHubTab(instance: HubInstanceRecord): HubTab {
  const serverId = serverIdFor(instance.port)
  return {
    id: tabIdForServerId(serverId),
    serverId,
    title: instance.projectName,
    snapshot: buildHubTabSnapshot(instance),
  }
}

export function formatShortPath(cwd: string): string {
  const parts = cwd.split('/').filter(Boolean)
  if (parts.length >= 2) return parts.slice(-2).join('/')
  return cwd || '(unknown)'
}

export function safeLoadHubTabStorage(storage: Storage = window.localStorage): HubTabStorage | null {
  try {
    const raw = storage.getItem(HUB_TAB_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<HubTabStorage>
    if (!Array.isArray(data.openServerIds) || typeof data.activeTabId !== 'string') return null
    return {
      openServerIds: data.openServerIds.filter((id): id is string => typeof id === 'string'),
      activeTabId: data.activeTabId,
      connectedTabId: typeof data.connectedTabId === 'string' ? data.connectedTabId : null,
      settingsTabOpen: data.settingsTabOpen === true,
    }
  } catch {
    return null
  }
}

export function saveHubTabStorage(state: HubTabStorage, storage: Storage = window.localStorage): void {
  try {
    storage.setItem(HUB_TAB_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Convenience state only. Ignore private-mode or quota failures.
  }
}

export function buildHubTabStorage(params: {
  tabs: HubTab[]
  activeTabId: string
  connectedTabId: string | null
  settingsTabOpen: boolean
}): HubTabStorage {
  return {
    openServerIds: params.tabs.map((tab) => tab.serverId),
    activeTabId: params.activeTabId,
    connectedTabId: params.connectedTabId,
    settingsTabOpen: params.settingsTabOpen,
  }
}

export function restoreHubTabs(params: {
  saved: HubTabStorage
  instances: HubInstanceRecord[]
  dashboardTabId: string
  settingsTabId: string
}): {
  tabs: HubTab[]
  activeTabId: string
  connectedTabId: string | null
  settingsTabOpen: boolean
} {
  const instancesByServerId = new Map(params.instances.map((instance) => [serverIdFor(instance.port), instance]))
  const tabs = params.saved.openServerIds
    .map((serverId) => instancesByServerId.get(serverId))
    .filter((instance): instance is HubInstanceRecord => Boolean(instance))
    .map(createHubTab)
  const validTabIds = new Set(tabs.map((tab) => tab.id))
  const activeTabId = params.saved.activeTabId === params.settingsTabId && params.saved.settingsTabOpen
    ? params.settingsTabId
    : validTabIds.has(params.saved.activeTabId)
      ? params.saved.activeTabId
      : params.dashboardTabId
  const connectedTab = tabs.find((tab) => tab.id === params.saved.connectedTabId)
  const connectedInstance = connectedTab ? instancesByServerId.get(connectedTab.serverId) : null

  return {
    tabs,
    activeTabId,
    connectedTabId: connectedInstance?.status === 'running' ? connectedTab!.id : null,
    settingsTabOpen: params.saved.settingsTabOpen,
  }
}
