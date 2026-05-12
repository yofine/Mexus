import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { AgentPane } from './AgentPane'
import { AddPaneDialog } from './AddPaneDialog'
import { SettingsDialog } from './SettingsDialog'
import { CommandPalette } from './CommandPalette'
import { ResizeHandle } from './ResizeHandle'
import { FileTree } from './FileTree'
import { EditorTabs } from './EditorTabs'
import { BottomTerminal } from './BottomTerminal'
import { BrandLockup } from './BrandMark'
import { Button } from './ui'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import type { ClientEvent } from '@/types'
import { Monitor, PanelsTopLeft, FolderTree, FolderOpen, Folder, Plus, SlidersHorizontal, X } from 'lucide-react'
import {
  AGENT_WIDTH_STEPS,
  DEFAULT_WIDTHS,
  FILE_WIDTH_STEPS,
  LAYOUT_EVENT,
  cycleStep,
  loadLayoutPreferences,
  resetModeWidths,
  saveModeWidths,
  type LayoutMode,
  type LayoutPanel,
  type PanelWidths,
} from '@/lib/layoutPreferences'
import { filterHubPanes, getExclusiveExpandedPaneId, getHubPaneFilterOptions } from './hubPaneFilters'

interface LayoutProps {
  send: (event: ClientEvent) => void
  hideHeader?: boolean
  hubMode?: boolean
}

type FileTreeHeaderActions = {
  expandAll: () => void
  collapseAll: () => void
}

export function Layout({ send, hideHeader = false, hubMode = false }: LayoutProps) {
  const panes = useWorkspaceStore((s) => s.panes)
  const activePaneId = useWorkspaceStore((s) => s.activePaneId)
  const setActivePaneId = useWorkspaceStore((s) => s.setActivePaneId)
  const name = useWorkspaceStore((s) => s.name)
  const connectionStatus = useWorkspaceStore((s) => s.connectionStatus)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [missionFilter, setMissionFilter] = useState('all')
  const [agentFilter, setAgentFilter] = useState('all')
  const [paneFiltersOpen, setPaneFiltersOpen] = useState(false)
  const [fileTreeActions, setFileTreeActions] = useState<FileTreeHeaderActions | null>(null)
  const [layoutPrefs, setLayoutPrefs] = useState(loadLayoutPreferences)
  const [widths, setWidths] = useState<PanelWidths>(() => loadLayoutPreferences().widthsByMode[loadLayoutPreferences().mode])
  const [maximizedPanel, setMaximizedPanel] = useState<Exclude<LayoutPanel, 'terminal'> | null>(null)
  const widthsRef = useRef(widths)
  widthsRef.current = widths

  const mode: LayoutMode = layoutPrefs.mode

  const syncLayoutPrefs = useCallback(() => {
    const prefs = loadLayoutPreferences()
    setLayoutPrefs(prefs)
    setWidths(prefs.widthsByMode[prefs.mode])
    setMaximizedPanel(null)
  }, [])

  useEffect(() => {
    window.addEventListener(LAYOUT_EVENT, syncLayoutPrefs)
    window.addEventListener('storage', syncLayoutPrefs)
    return () => {
      window.removeEventListener(LAYOUT_EVENT, syncLayoutPrefs)
      window.removeEventListener('storage', syncLayoutPrefs)
    }
  }, [syncLayoutPrefs])

  const handleTogglePane = useCallback(
    (paneId: string) => {
      const current = useWorkspaceStore.getState().activePaneId
      setActivePaneId(current === paneId ? null : paneId)
    },
    [setActivePaneId],
  )

  const handleOpenAddPane = useCallback(() => setShowAddDialog(true), [])
  const handleToggleCommandPalette = useCallback(() => setShowCommandPalette(v => !v), [])
  const handleOpenSettings = useCallback(() => setShowSettings(true), [])

  const persistWidths = useCallback((next: PanelWidths) => {
    saveModeWidths(mode, next)
    setLayoutPrefs(loadLayoutPreferences())
  }, [mode])

  const handleResizeAgents = useCallback((delta: number) => {
    if (maximizedPanel === 'editor') return
    setWidths(w => ({ ...w, agents: Math.max(280, w.agents + delta) }))
  }, [maximizedPanel])

  const handleResizeFiles = useCallback((delta: number) => {
    if (maximizedPanel === 'editor') return
    setWidths(w => ({ ...w, files: Math.max(160, w.files - delta) }))
  }, [maximizedPanel])

  const handleSaveWidths = useCallback(() => {
    persistWidths(widthsRef.current)
  }, [persistWidths])

  const handleCycleAgentsWidth = useCallback(() => {
    setWidths((w) => {
      const next = { ...w, agents: cycleStep(AGENT_WIDTH_STEPS, w.agents) }
      persistWidths(next)
      return next
    })
  }, [persistWidths])

  const handleCycleFilesWidth = useCallback(() => {
    setWidths((w) => {
      const next = { ...w, files: cycleStep(FILE_WIDTH_STEPS, w.files) }
      persistWidths(next)
      return next
    })
  }, [persistWidths])

  const handleResetAgentsWidth = useCallback(() => {
    setWidths((w) => {
      const next = { ...w, agents: DEFAULT_WIDTHS[mode].agents }
      persistWidths(next)
      return next
    })
  }, [mode, persistWidths])

  const handleResetFilesWidth = useCallback(() => {
    setWidths((w) => {
      const next = { ...w, files: DEFAULT_WIDTHS[mode].files }
      persistWidths(next)
      return next
    })
  }, [mode, persistWidths])

  const handleToggleMaximize = useCallback((panel: Exclude<LayoutPanel, 'terminal'>) => {
    if (panel !== 'editor') return
    setMaximizedPanel((current) => (current === 'editor' ? null : 'editor'))
  }, [])

  const isEditorFullscreen = maximizedPanel === 'editor'
  const paneFilterOptions = useMemo(() => getHubPaneFilterOptions(panes), [panes])
  const missionFilterOptions = paneFilterOptions.missions
  const agentFilterOptions = paneFilterOptions.agents
  const filteredPanes = useMemo(() => filterHubPanes(panes, missionFilter, agentFilter), [agentFilter, missionFilter, panes])
  const exclusiveExpandedPaneId = useMemo(
    () => getExclusiveExpandedPaneId(filteredPanes, activePaneId),
    [activePaneId, filteredPanes],
  )
  const paneFilterActive = missionFilter !== 'all' || agentFilter !== 'all'
  const paneFilterSummary = [
    missionFilter === 'all' ? null : missionFilter === '__none__' ? 'No mission' : missionFilter,
    agentFilter === 'all' ? null : agentFilter,
  ].filter(Boolean).join(' / ')
  const clearPaneFilters = useCallback(() => {
    setMissionFilter('all')
    setAgentFilter('all')
  }, [])

  useKeyboardShortcuts({
    send,
    onToggleCommandPalette: handleToggleCommandPalette,
    onAddPane: handleOpenAddPane,
    onOpenSettings: handleOpenSettings,
  })

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      {!hideHeader && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-md)',
            padding: '0 var(--space-lg)',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            flexShrink: 0,
            height: 'var(--header-height)',
            boxSizing: 'border-box',
          }}
        >
          <BrandLockup subtitle="Multi-agent execution" />
          {name && (
            <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-secondary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </span>
          )}
          <div
            style={{
              marginLeft: 'auto',
              width: 'var(--space-md)',
              height: 'var(--space-md)',
              borderRadius: '50%',
              background:
                connectionStatus === 'connected'
                  ? 'var(--status-running)'
                  : connectionStatus === 'reconnecting'
                    ? 'var(--status-waiting)'
                    : 'var(--status-error)',
            }}
            title={connectionStatus}
          />
        </div>
      )}

      {showSettings ? (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <SettingsDialog
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
          />
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flex: 1,
            minHeight: 0,
            width: '100%',
            overflow: 'hidden',
          }}
        >
        {!isEditorFullscreen && (
          <>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden',
                width: widths.agents,
                flexShrink: 0,
              }}
            >
              <div className="pane-panel-header">
                <div className="pane-panel-header__title">
                  <PanelsTopLeft className="icon-sm" />
                  <span>Panes</span>
                </div>
                <div className="pane-panel-header__actions">
                  {panes.length > 0 && (
                    <button
                      type="button"
                      className={`pane-filter-toggle ${paneFiltersOpen ? 'pane-filter-toggle--open' : ''} ${paneFilterActive ? 'pane-filter-toggle--active' : ''}`}
                      title="Filter panes"
                      onClick={() => setPaneFiltersOpen((open) => !open)}
                    >
                      <SlidersHorizontal size={13} />
                      <span>{paneFilterActive ? paneFilterSummary : 'Filter'}</span>
                    </button>
                  )}
                  <Button variant="secondary" size="sm" onClick={handleOpenAddPane} title="Add pane">
                    <Plus size={14} />
                    Add
                  </Button>
                </div>
              </div>
              {panes.length > 0 && paneFiltersOpen && (
                <div className="pane-filter-bar">
                  <label className="pane-filter-field">
                    <span>Mission</span>
                    <select
                      value={missionFilter}
                      onChange={(e) => setMissionFilter(e.target.value)}
                      className="pane-filter-select"
                      title="Filter by mission"
                    >
                      <option value="all">All missions</option>
                      <option value="__none__">No mission</option>
                      {missionFilterOptions.map((missionName) => (
                        <option key={missionName} value={missionName}>{missionName}</option>
                      ))}
                    </select>
                  </label>
                  <label className="pane-filter-field">
                    <span>Agent</span>
                    <select
                      value={agentFilter}
                      onChange={(e) => setAgentFilter(e.target.value)}
                      className="pane-filter-select"
                      title="Filter by agent type"
                    >
                      <option value="all">All agents</option>
                      {agentFilterOptions.map((agentType) => (
                        <option key={agentType} value={agentType}>{agentType}</option>
                      ))}
                    </select>
                  </label>
                  {paneFilterActive && (
                    <button type="button" className="pane-filter-clear" onClick={clearPaneFilters} title="Clear pane filters">
                      <X size={13} />
                    </button>
                  )}
                </div>
              )}
              <div
                className={`pane-stack ${exclusiveExpandedPaneId ? 'pane-stack--exclusive-expanded' : ''}`}
              >
                {panes.length === 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      gap: 'var(--space-lg)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <Monitor className="icon-hero" />
                    <span style={{ fontSize: 'var(--font-lg)' }}>No execution panes yet</span>
                    <Button variant="primary" onClick={handleOpenAddPane}>
                        Create execution pane
                    </Button>
                  </div>
                )}

                {panes.length > 0 && filteredPanes.length === 0 && (
                  <div className="pane-filter-empty">
                    No panes match the current filters.
                  </div>
                )}

                {filteredPanes.map((pane, index) => (
                  <AgentPane
                    key={pane.id}
                    pane={pane}
                    paneIndex={index}
                    isExpanded={activePaneId === pane.id}
                    isHidden={Boolean(exclusiveExpandedPaneId && exclusiveExpandedPaneId !== pane.id)}
                    onToggle={() => handleTogglePane(pane.id)}
                    send={send}
                  />
                ))}
              </div>
            </div>

            <ResizeHandle
              onResize={handleResizeAgents}
              onResizeEnd={handleSaveWidths}
              onCycleWidth={handleCycleAgentsWidth}
              onResetWidth={handleResetAgentsWidth}
            />
          </>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            flex: 1,
            minWidth: 300,
          }}
        >
          <EditorTabs
            send={send}
            isMaximized={maximizedPanel === 'editor'}
            onToggleMaximize={() => handleToggleMaximize('editor')}
          />
        </div>

        {!isEditorFullscreen && (
          <>
            <ResizeHandle
              onResize={handleResizeFiles}
              onResizeEnd={handleSaveWidths}
              onCycleWidth={handleCycleFilesWidth}
              onResetWidth={handleResetFilesWidth}
            />

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                width: widths.files,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-md)',
                  padding: '0 var(--space-xl)',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  flexShrink: 0,
                  height: 'var(--header-height)',
                  boxSizing: 'border-box',
                }}
              >
                <FolderTree className="icon-sm" style={{ color: 'var(--text-secondary)' }} />
                <span style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Files
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                  <button
                    type="button"
                    className="pane-action-btn"
                    title="Expand all"
                    onClick={() => fileTreeActions?.expandAll()}
                    disabled={!fileTreeActions}
                  >
                    <FolderOpen className="icon-xs" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  <button
                    type="button"
                    className="pane-action-btn"
                    title="Collapse all"
                    onClick={() => fileTreeActions?.collapseAll()}
                    disabled={!fileTreeActions}
                  >
                    <Folder className="icon-xs" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                <FileTree onActionsReady={setFileTreeActions} />
              </div>
            </div>
          </>
        )}
        </div>
      )}

      <AddPaneDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        send={send}
      />

      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        send={send}
        onAddPane={handleOpenAddPane}
      />

      <BottomTerminal send={send} />
    </div>
  )
}
