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
import { getPaneColorById } from './AgentIcon'
import { Button } from './ui'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import type { ClientEvent } from '@/types'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Monitor, PanelsTopLeft, FolderTree, FolderMinus, Plus, Settings, SlidersHorizontal, X } from 'lucide-react'
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
import { filterHubPanes, getExclusiveExpandedPaneId, getHubPaneFilterOptions, orderPinnedPaneFirst } from './hubPaneFilters'

interface LayoutProps {
  send: (event: ClientEvent) => void
  hideHeader?: boolean
  hubMode?: boolean
}

type FileTreeHeaderActions = {
  expandAll: () => void
  collapseAll: () => void
}

type PaneFilterMenuOption = {
  value: string
  label: string
}

function PaneFilterMenu({
  label,
  title,
  value,
  options,
  isOpen,
  onToggle,
  onChange,
}: {
  label: string
  title: string
  value: string
  options: PaneFilterMenuOption[]
  isOpen: boolean
  onToggle: () => void
  onChange: (value: string) => void
}) {
  const selected = options.find((option) => option.value === value) || options[0]

  return (
    <div className={`pane-filter-menu ${isOpen ? 'pane-filter-menu--open' : ''}`}>
      <span className="pane-filter-menu__label">{label}</span>
      <button
        type="button"
        className="pane-filter-menu__trigger"
        title={title}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <span>{selected?.label || 'All'}</span>
        <ChevronDown size={12} />
      </button>
      {isOpen && (
        <div className="pane-filter-menu__popover" role="listbox" aria-label={title}>
          {options.map((option) => {
            const active = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                className={`pane-filter-menu__option ${active ? 'pane-filter-menu__option--active' : ''}`}
                role="option"
                aria-selected={active}
                onClick={() => onChange(option.value)}
              >
                <span>{option.label}</span>
                {active && <Check size={12} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Layout({ send, hideHeader = false, hubMode = false }: LayoutProps) {
  const panes = useWorkspaceStore((s) => s.panes)
  const workspaceLoaded = useWorkspaceStore((s) => s.workspaceLoaded)
  const activePaneId = useWorkspaceStore((s) => s.activePaneId)
  const setActivePaneId = useWorkspaceStore((s) => s.setActivePaneId)
  const name = useWorkspaceStore((s) => s.name)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [missionFilter, setMissionFilter] = useState('all')
  const [agentFilter, setAgentFilter] = useState('all')
  const [pinnedPaneId, setPinnedPaneId] = useState<string | null>(null)
  const [paneFiltersOpen, setPaneFiltersOpen] = useState(false)
  const [openPaneFilterMenu, setOpenPaneFilterMenu] = useState<'mission' | 'agent' | null>(null)
  const [filesCollapsed, setFilesCollapsed] = useState(false)
  const [fileTreeActions, setFileTreeActions] = useState<FileTreeHeaderActions | null>(null)
  const [layoutPrefs, setLayoutPrefs] = useState(loadLayoutPreferences)
  const [widths, setWidths] = useState<PanelWidths>(() => loadLayoutPreferences().widthsByMode[loadLayoutPreferences().mode])
  const [maximizedPanel, setMaximizedPanel] = useState<Exclude<LayoutPanel, 'terminal'> | null>(null)
  const widthsRef = useRef(widths)
  const paneFilterBarRef = useRef<HTMLDivElement | null>(null)
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
  const missionFilterMenuOptions = useMemo<PaneFilterMenuOption[]>(() => [
    { value: 'all', label: 'All missions' },
    { value: '__none__', label: 'No mission' },
    ...missionFilterOptions.map((missionName) => ({ value: missionName, label: missionName })),
  ], [missionFilterOptions])
  const agentFilterMenuOptions = useMemo<PaneFilterMenuOption[]>(() => [
    { value: 'all', label: 'All agents' },
    ...agentFilterOptions.map((agentType) => ({ value: agentType, label: agentType })),
  ], [agentFilterOptions])
  const filteredPanes = useMemo(() => filterHubPanes(panes, missionFilter, agentFilter), [agentFilter, missionFilter, panes])
  const orderedFilteredPanes = useMemo(
    () => orderPinnedPaneFirst(filteredPanes, pinnedPaneId),
    [filteredPanes, pinnedPaneId],
  )
  const exclusiveExpandedPaneId = useMemo(
    () => getExclusiveExpandedPaneId(orderedFilteredPanes, activePaneId),
    [activePaneId, orderedFilteredPanes],
  )
  const paneFilterActive = missionFilter !== 'all' || agentFilter !== 'all'
  const paneFilterSummary = [
    missionFilter === 'all' ? null : missionFilter === '__none__' ? 'No mission' : missionFilter,
    agentFilter === 'all' ? null : agentFilter,
  ].filter(Boolean).join(' / ')
  const clearPaneFilters = useCallback(() => {
    setMissionFilter('all')
    setAgentFilter('all')
    setOpenPaneFilterMenu(null)
  }, [])

  const handleTogglePinnedPane = useCallback((paneId: string) => {
    setPinnedPaneId((current) => (current === paneId ? null : paneId))
  }, [])

  useEffect(() => {
    if (pinnedPaneId && !panes.some((pane) => pane.id === pinnedPaneId)) {
      setPinnedPaneId(null)
    }
  }, [panes, pinnedPaneId])

  useEffect(() => {
    if (!paneFiltersOpen || !openPaneFilterMenu) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!paneFilterBarRef.current?.contains(event.target as Node)) {
        setOpenPaneFilterMenu(null)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenPaneFilterMenu(null)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [openPaneFilterMenu, paneFiltersOpen])

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
            background: 'var(--bg-header)',
            flexShrink: 0,
            height: 'var(--header-height)',
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
          <BrandLockup subtitle="Multi-agent execution" />
          {name && (
            <span
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                maxWidth: 'min(420px, calc(100% - 320px))',
                fontSize: 'var(--font-sm)',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textAlign: 'center',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              {name}
            </span>
          )}
          <button
            type="button"
            className="app-header-icon-btn"
            onClick={handleOpenSettings}
            title="Settings"
            aria-label="Settings"
            style={{ marginLeft: 'auto' }}
          >
            <Settings size={15} />
          </button>
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
                <div className="pane-filter-bar" ref={paneFilterBarRef}>
                  <PaneFilterMenu
                    label="Mission"
                    title="Filter by mission"
                    value={missionFilter}
                    options={missionFilterMenuOptions}
                    isOpen={openPaneFilterMenu === 'mission'}
                    onToggle={() => setOpenPaneFilterMenu((current) => (current === 'mission' ? null : 'mission'))}
                    onChange={(nextValue) => {
                      setMissionFilter(nextValue)
                      setOpenPaneFilterMenu(null)
                    }}
                  />
                  <PaneFilterMenu
                    label="Agent"
                    title="Filter by agent type"
                    value={agentFilter}
                    options={agentFilterMenuOptions}
                    isOpen={openPaneFilterMenu === 'agent'}
                    onToggle={() => setOpenPaneFilterMenu((current) => (current === 'agent' ? null : 'agent'))}
                    onChange={(nextValue) => {
                      setAgentFilter(nextValue)
                      setOpenPaneFilterMenu(null)
                    }}
                  />
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
                {!workspaceLoaded && (
                  <div className="pane-stack-loading" aria-hidden="true" />
                )}

                {workspaceLoaded && panes.length === 0 && (
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

                {orderedFilteredPanes.map((pane, index) => (
                  <AgentPane
                    key={pane.id}
                    pane={pane}
                    paneIndex={index}
                    paneColor={getPaneColorById(pane.id, panes)}
                    isExpanded={activePaneId === pane.id}
                    isHidden={Boolean(exclusiveExpandedPaneId && exclusiveExpandedPaneId !== pane.id)}
                    onToggle={() => handleTogglePane(pane.id)}
                    isPinned={pinnedPaneId === pane.id}
                    onTogglePin={() => handleTogglePinnedPane(pane.id)}
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
            {!filesCollapsed && (
              <ResizeHandle
                onResize={handleResizeFiles}
                onResizeEnd={handleSaveWidths}
                onCycleWidth={handleCycleFilesWidth}
                onResetWidth={handleResetFilesWidth}
              />
            )}

            <div
              className={`files-panel ${filesCollapsed ? 'files-panel--collapsed' : ''}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                width: filesCollapsed ? 14 : widths.files,
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                className="files-panel-toggle"
                title={filesCollapsed ? 'Show files' : 'Hide files'}
                onClick={() => setFilesCollapsed((collapsed) => !collapsed)}
              >
                {filesCollapsed ? <ChevronLeft size={11} /> : <ChevronRight size={11} />}
              </button>

              {!filesCollapsed && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-md)',
                      padding: '0 var(--space-xl)',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: 'var(--bg-header)',
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
                        title="Collapse all"
                        onClick={() => fileTreeActions?.collapseAll()}
                        disabled={!fileTreeActions}
                      >
                        <FolderMinus className="icon-xs" style={{ color: 'var(--text-secondary)' }} />
                      </button>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                    <FileTree onActionsReady={setFileTreeActions} />
                  </div>
                </>
              )}
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
