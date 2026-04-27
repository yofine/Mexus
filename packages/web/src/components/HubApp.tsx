import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { FolderPlus, Play, Power, Server, Settings, Trash2, X } from 'lucide-react'
import { WorkspaceApp } from './WorkspaceApp'
import { BrandLockup } from './BrandMark'
import { SettingsDialog } from './SettingsDialog'
import { hubApi } from '@/lib/apiBase'
import {
  buildHubTabSnapshot,
  buildHubTabStorage,
  createHubTab,
  formatShortPath,
  restoreHubTabs,
  safeLoadHubTabStorage,
  saveHubTabStorage,
  serverIdFor,
  type HubTab,
} from '@/lib/hubTabs'
import { debugLog } from '@/lib/debugLog'
import { useConnectionStore } from '@/stores/connectionStore'
import type { ConnectionTarget, HubInstanceRecord } from '@/types'

const DASHBOARD_TAB = 'hub:dashboard'
const SETTINGS_TAB = 'hub:settings'

function targetFor(instance: HubInstanceRecord): ConnectionTarget {
  const origin = `${window.location.origin}/api/instances/${instance.port}/proxy`
  return {
    serverId: serverIdFor(instance.port),
    label: instance.projectName,
    httpBaseUrl: origin,
    wsBaseUrl: origin,
  }
}

function formatUptime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function HubApp() {
  const [instances, setInstances] = useState<HubInstanceRecord[]>([])
  const [tabs, setTabs] = useState<HubTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string>(DASHBOARD_TAB)
  const [connectedTabId, setConnectedTabId] = useState<string | null>(null)
  const [settingsTabOpen, setSettingsTabOpen] = useState(false)
  const [tabsRestored, setTabsRestored] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [cwdInput, setCwdInput] = useState('')
  const [portInput, setPortInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (scan = false): Promise<HubInstanceRecord[]> => {
    try {
      const res = await fetch(hubApi(`/api/instances${scan ? '?scan=1' : ''}`))
      const data = await res.json() as { instances: HubInstanceRecord[]; error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to load instances')
      setInstances(data.instances)
      setTabs((current) => current.map((tab) => {
        const instance = data.instances.find((item) => serverIdFor(item.port) === tab.serverId)
        return instance ? {
          ...tab,
          title: instance.projectName,
          snapshot: buildHubTabSnapshot(instance),
        } : tab
      }))
      setError(null)
      return data.instances
    } catch (err) {
      setError((err as Error).message)
      return []
    }
  }, [])

  useEffect(() => {
    refresh(true).then((nextInstances) => {
      const saved = safeLoadHubTabStorage()
      if (saved) {
        const restored = restoreHubTabs({
          saved,
          instances: nextInstances,
          dashboardTabId: DASHBOARD_TAB,
          settingsTabId: SETTINGS_TAB,
        })
        setTabs(restored.tabs)
        setActiveTabId(restored.activeTabId)
        setConnectedTabId(restored.connectedTabId)
        setSettingsTabOpen(restored.settingsTabOpen)
      }
      setTabsRestored(true)
    })
  }, [refresh])

  useEffect(() => {
    const timer = window.setInterval(() => {
      refresh(false)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const instanceByServerId = useMemo(
    () => new Map(instances.map((instance) => [serverIdFor(instance.port), instance])),
    [instances],
  )

  const activeTab = tabs.find((tab) => tab.id === activeTabId) || null
  const activeInstance = activeTab ? instanceByServerId.get(activeTab.serverId) || null : null
  const connectedTab = tabs.find((tab) => tab.id === connectedTabId) || null
  const connectedInstance = connectedTab ? instanceByServerId.get(connectedTab.serverId) || null : null
  const connectedTarget = useMemo(
    () => connectedInstance && connectedInstance.status === 'running' ? targetFor(connectedInstance) : null,
    [connectedInstance?.port, connectedInstance?.projectName, connectedInstance?.status],
  )

  useEffect(() => {
    debugLog('hub', 'connectedTarget:update', {
      activeTabId,
      connectedTabId,
      serverId: connectedTarget?.serverId || null,
      label: connectedTarget?.label || null,
      httpBaseUrl: connectedTarget?.httpBaseUrl || null,
    })
    useConnectionStore.getState().setActiveTarget(connectedTarget)
  }, [activeTabId, connectedTabId, connectedTarget])

  useEffect(() => {
    if (!tabsRestored) return
    saveHubTabStorage(buildHubTabStorage({
      tabs,
      activeTabId,
      connectedTabId,
      settingsTabOpen,
    }))
  }, [activeTabId, connectedTabId, settingsTabOpen, tabs, tabsRestored])

  useEffect(() => {
    if (connectedTab && (!connectedInstance || connectedInstance.status !== 'running')) {
      setConnectedTabId(null)
    }
  }, [connectedTab, connectedInstance?.status])

  const activateTab = useCallback((tab: HubTab) => {
    setActiveTabId(tab.id)
    const instance = instanceByServerId.get(tab.serverId)
    if (instance?.status === 'running' && tab.id !== connectedTabId) {
      setConnectedTabId(tab.id)
    }
  }, [connectedTabId, instanceByServerId])

  const openTab = useCallback((instance: HubInstanceRecord) => {
    const serverId = serverIdFor(instance.port)
    const existing = tabs.find((tab) => tab.serverId === serverId)
    if (existing) {
      activateTab(existing)
      return
    }
    const nextTab = createHubTab(instance)
    setTabs((current) => [...current, nextTab])
    setActiveTabId(nextTab.id)
    if (instance.status === 'running') setConnectedTabId(nextTab.id)
  }, [activateTab, tabs])

  const closeTab = useCallback((tabId: string) => {
    setTabs((current) => current.filter((tab) => tab.id !== tabId))
    setActiveTabId((current) => current === tabId ? DASHBOARD_TAB : current)
    setConnectedTabId((current) => current === tabId ? null : current)
  }, [])

  const openSettingsTab = useCallback(() => {
    setSettingsTabOpen(true)
    setActiveTabId(SETTINGS_TAB)
  }, [])

  const closeSettingsTab = useCallback(() => {
    setSettingsTabOpen(false)
    setActiveTabId((current) => current === SETTINGS_TAB ? DASHBOARD_TAB : current)
  }, [])

  const createInstance = useCallback(async () => {
    if (!cwdInput.trim()) {
      setError('Project path is required')
      return
    }
    setIsCreating(true)
    try {
      const body: { cwd: string; port?: number } = { cwd: cwdInput.trim() }
      if (portInput.trim()) body.port = parseInt(portInput.trim(), 10)
      const res = await fetch(hubApi('/api/instances'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { error?: string; port?: number }
      if (!res.ok) throw new Error(data.error || 'Failed to start instance')
      setCwdInput('')
      setPortInput('')
      const nextInstances = await refresh(true)
      const instance = data.port ? (nextInstances.find((item) => item.port === data.port) || null) : null
      if (instance) openTab(instance)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsCreating(false)
    }
  }, [cwdInput, portInput, refresh, openTab])

  const startInstance = useCallback(async (instance: HubInstanceRecord) => {
    setError(null)
    const res = await fetch(hubApi(`/api/instances/${instance.port}/start`), { method: 'POST' })
    const data = await res.json() as { error?: string }
    if (!res.ok) {
      setError(data.error || 'Failed to start instance')
      return
    }
    await refresh(true)
  }, [refresh])

  const stopInstance = useCallback(async (instance: HubInstanceRecord) => {
    setError(null)
    const res = await fetch(hubApi(`/api/instances/${instance.port}/stop`), { method: 'POST' })
    const data = await res.json() as { error?: string }
    if (!res.ok) {
      setError(data.error || 'Failed to stop instance')
      return
    }
    const stoppedServerId = serverIdFor(instance.port)
    setConnectedTabId((current) => {
      const connected = tabs.find((tab) => tab.id === current)
      return connected?.serverId === stoppedServerId ? null : current
    })
    await refresh(true)
  }, [refresh, tabs])

  const removeInstance = useCallback(async (instance: HubInstanceRecord) => {
    setError(null)
    const res = await fetch(hubApi(`/api/instances/${instance.port}`), { method: 'DELETE' })
    const data = await res.json() as { error?: string }
    if (!res.ok) {
      setError(data.error || 'Failed to remove instance')
      return
    }
    const removedServerId = serverIdFor(instance.port)
    setTabs((current) => current.filter((tab) => tab.serverId !== removedServerId))
    setActiveTabId((current) => {
      const active = tabs.find((tab) => tab.id === current)
      return active?.serverId === removedServerId ? DASHBOARD_TAB : current
    })
    setConnectedTabId((current) => {
      const connected = tabs.find((tab) => tab.id === current)
      return connected?.serverId === removedServerId ? null : current
    })
    await refresh(false)
  }, [refresh, tabs])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      <div style={{ height: 40, display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', overflow: 'hidden' }}>
        <div style={brandAreaStyle}>
          <BrandLockup subtitle="Operator console" />
        </div>
        <div style={tabRailStyle}>
        <button onClick={() => setActiveTabId(DASHBOARD_TAB)} style={tabStyle(activeTabId === DASHBOARD_TAB)}>
          <Server size={13} />
          Hub
        </button>
        {settingsTabOpen && (
          <button onClick={() => setActiveTabId(SETTINGS_TAB)} style={tabStyle(activeTabId === SETTINGS_TAB)}>
            <Settings size={13} />
            Settings
            <span
              onClick={(event) => {
                event.stopPropagation()
                closeSettingsTab()
              }}
              style={{ marginLeft: 4, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center' }}
            >
              <X size={12} />
            </span>
          </button>
        )}
        {tabs.map((tab) => {
          const instance = instanceByServerId.get(tab.serverId)
          const status = instance?.status || tab.snapshot.status
          const connected = tab.id === connectedTabId
          const snapshot = instance ? buildHubTabSnapshot(instance) : tab.snapshot
          const tabTitle = [
            snapshot.projectName,
            `port: ${snapshot.port}`,
            `status: ${snapshot.status}`,
            `pid: ${snapshot.pid || 'n/a'}`,
            snapshot.cwd,
          ].join('\n')
          return (
            <button key={tab.id} onClick={() => activateTab(tab)} title={tabTitle} style={tabStyle(activeTabId === tab.id)}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? 'var(--accent-primary)' : status === 'running' ? 'var(--status-running)' : 'var(--status-error)', flexShrink: 0 }} />
              <span style={tabTitleStyle}>{snapshot.projectName || tab.title}</span>
              <span style={tabMetaStyle}>:{snapshot.port}</span>
              <span style={{ ...tabMetaStyle, maxWidth: 128 }}>{formatShortPath(snapshot.cwd)}</span>
              <span
                onClick={(event) => {
                  event.stopPropagation()
                  closeTab(tab.id)
                }}
                style={tabCloseStyle}
              >
                <X size={12} />
              </span>
            </button>
          )
        })}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, position: 'relative' }}>
          {connectedTarget && (
            <div style={{ position: 'absolute', inset: 0, display: activeTabId === connectedTabId ? 'block' : 'none' }}>
              <WorkspaceApp key={connectedTarget.serverId} target={connectedTarget} hideHeader hubMode />
            </div>
          )}
          {activeTabId === DASHBOARD_TAB ? (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'minmax(560px, 1fr) 360px', overflow: 'hidden' }}>
            <div style={{ padding: 20, overflow: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0, color: 'var(--text-secondary)', marginBottom: 4 }}>Local execution servers</div>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>{instances.length} tracked instances</div>
                </div>
                <button onClick={openSettingsTab} title="Mexus Settings" style={settingsButtonStyle}>
                  <Settings size={15} />
                  Settings
                </button>
              </div>
              {error && (
                <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(248,81,73,0.35)', color: 'var(--status-error)', background: 'rgba(248,81,73,0.08)' }}>
                  {error}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 12 }}>
                {instances.length === 0 && (
                  <div style={{ padding: 36, borderRadius: 10, border: '1px dashed var(--border-default)', color: 'var(--text-muted)', textAlign: 'center' }}>
                    No execution servers tracked. Start one from the panel on the right.
                  </div>
                )}
                {instances.map((instance) => (
                  <div key={instance.port} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--bg-surface)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: instance.status === 'running' ? 'var(--status-running)' : 'var(--status-error)' }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{instance.projectName}</span>
                        </div>
                        <div style={{ marginTop: 4, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{instance.cwd}</div>
                      </div>
                      <span style={{ borderRadius: 6, padding: '2px 8px', background: 'var(--accent-subtle)', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>:{instance.port}</span>
                    </div>
                    <div style={{ display: 'grid', gap: 4, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      <div>pid: {instance.pid || '—'}</div>
                      <div>status: {instance.status}</div>
                      <div>started: {formatUptime(instance.startedAt)}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center' }}>
                      <button onClick={() => openTab(instance)} style={primaryButtonStyle}>
                        {tabs.some((tab) => tab.serverId === serverIdFor(instance.port)) ? 'Focus Tab' : 'Open Tab'}
                      </button>
                      {instance.status === 'running' ? (
                        <button onClick={() => stopInstance(instance)} style={ghostButtonStyle}>
                          <Power size={14} />
                          Stop
                        </button>
                      ) : (
                        <button onClick={() => startInstance(instance)} style={ghostButtonStyle}>
                          <Play size={14} />
                          Start
                        </button>
                      )}
                      <button onClick={() => removeInstance(instance)} style={dangerButtonStyle}>
                        <Trash2 size={14} />
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderLeft: '1px solid var(--border-subtle)', padding: 20, background: 'var(--bg-surface)', overflow: 'auto' }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0, color: 'var(--text-secondary)', marginBottom: 8 }}>New execution server</div>
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 18 }}>Start execution server</div>
              <label style={labelStyle}>
                Project path
                <input value={cwdInput} onChange={(event) => setCwdInput(event.target.value)} placeholder="~/projects/my-app" style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Port
                <input value={portInput} onChange={(event) => setPortInput(event.target.value)} placeholder="Auto assign" style={inputStyle} />
              </label>
              <button onClick={createInstance} disabled={isCreating} style={{ ...primaryButtonStyle, width: '100%', justifyContent: 'center', marginTop: 6 }}>
                <FolderPlus size={14} />
                {isCreating ? 'Starting…' : 'Create server'}
              </button>
              <div style={{ marginTop: 14, color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>
                Mexus Hub owns the tabs and connection state. The Hub view keeps the current server connection alive; opening another running server switches the active connection.
              </div>
            </div>
          </div>
          ) : activeTabId === SETTINGS_TAB && settingsTabOpen ? (
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
              <SettingsDialog isOpen onClose={closeSettingsTab} scope="hub" mode="page" />
            </div>
          ) : activeTabId === connectedTabId && connectedTarget ? null : (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--text-secondary)', padding: 24 }}>
              <div style={{ maxWidth: 480, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 10 }}>{activeTab?.snapshot.projectName || 'Disconnected server'}</div>
                <div style={{ marginBottom: 16 }}>
                  This tab is not connected. Start the local server again to reconnect, or close/remove the tab if you no longer need it.
                </div>
                {activeInstance ? (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                    <button onClick={() => startInstance(activeInstance)} style={primaryButtonStyle}>
                      <Play size={14} />
                      Start server
                    </button>
                    <button onClick={() => removeInstance(activeInstance)} style={dangerButtonStyle}>
                      <Trash2 size={14} />
                      Remove Record
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function tabStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 11px',
    border: 'none',
    borderRight: '1px solid var(--border-subtle)',
    background: active ? 'var(--bg-base)' : 'var(--bg-surface)',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    cursor: 'pointer',
    minWidth: 0,
    flexShrink: 0,
    fontFamily: 'inherit',
    fontSize: 'var(--font-xs)',
    fontWeight: active ? 560 : 500,
    lineHeight: '18px',
  }
}

const brandAreaStyle: CSSProperties = {
  width: 210,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '0 18px',
  borderRight: '1px solid var(--border-subtle)',
}

const tabRailStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  minWidth: 0,
  overflowX: 'auto',
  flex: 1,
  paddingLeft: 8,
}

const tabTextTrackStyle: CSSProperties = {
  height: 18,
  minWidth: 0,
  display: 'inline-flex',
  alignItems: 'center',
  lineHeight: '18px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const tabTitleStyle: CSSProperties = {
  ...tabTextTrackStyle,
  maxWidth: 140,
}

const tabMetaStyle: CSSProperties = {
  ...tabTextTrackStyle,
  color: 'var(--text-muted)',
  fontSize: 11,
}

const tabCloseStyle: CSSProperties = {
  marginLeft: 4,
  color: 'var(--text-muted)',
  height: 18,
  display: 'inline-flex',
  alignItems: 'center',
  lineHeight: '18px',
}

const inputStyle: CSSProperties = {
  width: '100%',
  marginTop: 6,
  borderRadius: 8,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-base)',
  color: 'var(--text-primary)',
  padding: '10px 12px',
  outline: 'none',
}

const labelStyle: CSSProperties = {
  display: 'block',
  color: 'var(--text-secondary)',
  fontSize: 12,
  marginBottom: 14,
}

const baseButtonStyle: CSSProperties = {
  border: '1px solid transparent',
  borderRadius: 8,
  padding: '8px 12px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const primaryButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: 'var(--accent-primary)',
  color: '#fff',
}

const ghostButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: 'transparent',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
}

const dangerButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: 'transparent',
  color: 'var(--status-error)',
  border: '1px solid rgba(248,81,73,0.35)',
}

const settingsButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  padding: '8px 10px',
  flexShrink: 0,
}
