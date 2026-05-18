import { useState, useCallback, useEffect, useLayoutEffect, useRef, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Terminal as TerminalIcon, ChevronDown, ChevronUp, Maximize2, Minimize2, Square, Eraser, Plus, X, GitBranch, GitCompare, Folder, Pencil } from 'lucide-react'
import { Terminal } from './Terminal'
import type { ClientEvent, PaneState } from '@/types'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { clearTerminalHistory, refitTerminal, unpauseTerminal } from '@/stores/terminalRegistry'
import { api } from '@/lib/apiBase'
import { debugLog, summarizeShells } from '@/lib/debugLog'
import {
  LAYOUT_EVENT,
  loadLayoutPreferences,
  saveModeTerminalHeight,
  type LayoutMode,
} from '@/lib/layoutPreferences'
import { getProjectCommands } from '@/lib/terminalCommands'

interface BottomTerminalProps {
  send: (event: ClientEvent) => void
}

const STATIC_COMMANDS = ['pwd', 'ls', 'git status', 'git diff --stat', 'git push']
const TERMINAL_COMMAND_BAR_HEIGHT = 42

function getNextShellName(shells: PaneState[]): string {
  let max = 0
  for (const pane of shells) {
    const match = pane.name.match(/^Shell (\d+)$/)
    if (match) {
      max = Math.max(max, parseInt(match[1], 10))
    }
  }
  return `Shell ${max + 1}`
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || path || 'workspace'
}

function AirSegment({
  children,
  color = 'var(--text-muted)',
  title,
}: {
  children: ReactNode
  color?: string
  title?: string
}) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        color,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.1,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

export function BottomTerminalHeader({
  isMaximized,
  onClose,
  onToggleMaximize,
  airline,
}: {
  isMaximized: boolean
  onClose: () => void
  onToggleMaximize: () => void
  airline: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: 'var(--space-xs) var(--space-lg)',
        gap: 'var(--space-md)',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}
    >
      <TerminalIcon className="icon-sm" style={{ color: 'var(--text-primary)' }} />
      <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>Terminal</span>
      <div style={{ marginLeft: 'var(--space-lg)', minWidth: 0 }}>
        {airline}
      </div>
      <button type="button" className="pane-action-btn bottom-terminal-instance-action" title="Minimize terminal" aria-label="Minimize terminal" data-label="Minimize" onClick={onClose}>
        <ChevronDown className="icon-xs" style={{ color: 'var(--text-secondary)' }} />
      </button>
      <button type="button" className="pane-action-btn bottom-terminal-instance-action" title={isMaximized ? 'Restore terminal' : 'Maximize terminal'} aria-label={isMaximized ? 'Restore terminal' : 'Maximize terminal'} data-label={isMaximized ? 'Restore' : 'Maximize'} onClick={onToggleMaximize} style={{ marginLeft: 'auto' }}>
        {isMaximized ? (
          <Minimize2 className="icon-xs" style={{ color: 'var(--accent-primary)' }} />
        ) : (
          <Maximize2 className="icon-xs" style={{ color: 'var(--text-secondary)' }} />
        )}
      </button>
    </div>
  )
}

export function BottomTerminal({ send }: BottomTerminalProps) {
  const initialPrefs = loadLayoutPreferences()
  const panelRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(initialPrefs.mode)
  const [heightPct, setHeightPct] = useState(initialPrefs.terminalHeightByMode[initialPrefs.mode])
  const [isMaximized, setIsMaximized] = useState(false)
  const [projectCommands, setProjectCommands] = useState<string[]>([])
  const [createError, setCreateError] = useState<string | null>(null)
  const [renamingPaneId, setRenamingPaneId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  // Pending commands: when a shell is created with a command, we wait for shell output before sending
  const pendingCommandRef = useRef<{ name: string; command: string } | null>(null)
  // Track shell panes that have received output (prompt is ready)
  const readyShellsRef = useRef<Set<string>>(new Set())

  const shellPanes = useWorkspaceStore((s) => s.shellPanes)
  const activeShellPaneId = useWorkspaceStore((s) => s.activeShellPaneId)
  const setActiveShellPaneId = useWorkspaceStore((s) => s.setActiveShellPaneId)
  const projectDir = useWorkspaceStore((s) => s.projectDir)
  const gitBranchInfo = useWorkspaceStore((s) => s.gitBranchInfo)
  const gitDiffs = useWorkspaceStore((s) => s.gitDiffs)
  const gitStagedDiffs = useWorkspaceStore((s) => s.gitStagedDiffs)
  const connectionStatus = useWorkspaceStore((s) => s.connectionStatus)

  // Mark restored shells as ready (they've already been outputting).
  useLayoutEffect(() => {
    debugLog('bottom-terminal', 'shellPanes:changed', {
      activeShellPaneId,
      connectionStatus,
      shells: summarizeShells(shellPanes),
    })
    for (const pane of shellPanes) {
      readyShellsRef.current.add(pane.id)
    }
  }, [activeShellPaneId, connectionStatus, shellPanes])

  // Keep shell terminals live. Hidden rendering optimization belongs in the
  // dedicated terminal runtime; this compatibility layer prioritizes input.
  const prevActiveRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevActiveRef.current
    for (const pane of shellPanes) {
      unpauseTerminal(pane.id)
    }
    if (activeShellPaneId && activeShellPaneId !== prev) {
      // Refit after a tick to ensure dimensions are correct
      requestAnimationFrame(() => refitTerminal(activeShellPaneId))
    }
    prevActiveRef.current = activeShellPaneId
  }, [activeShellPaneId, shellPanes])

  // Sync layout preferences
  useEffect(() => {
    const syncLayoutPrefs = () => {
      const prefs = loadLayoutPreferences()
      setLayoutMode(prefs.mode)
      setHeightPct(prefs.terminalHeightByMode[prefs.mode])
      setIsMaximized(false)
    }
    window.addEventListener(LAYOUT_EVENT, syncLayoutPrefs)
    window.addEventListener('storage', syncLayoutPrefs)
    return () => {
      window.removeEventListener(LAYOUT_EVENT, syncLayoutPrefs)
      window.removeEventListener('storage', syncLayoutPrefs)
    }
  }, [])

  // Load project commands. Re-fetch when the connected workspace changes —
  // in Hub mode the active target is set after BottomTerminal first mounts,
  // and projectDir is the reliable "connected" signal that also updates when
  // switching between server tabs.
  useEffect(() => {
    if (!projectDir) {
      setProjectCommands([])
      return
    }
    let cancelled = false
    fetch(api('/api/file?path=package.json'))
      .then((res) => res.ok ? res.json() : null)
      .then((data: { content: string } | null) => {
        if (cancelled) return
        if (!data?.content) {
          setProjectCommands([])
          return
        }
        const parsed = JSON.parse(data.content) as { scripts?: Record<string, string> }
        setProjectCommands(getProjectCommands(parsed.scripts || {}))
      })
      .catch(() => {
        if (!cancelled) setProjectCommands([])
      })
    return () => { cancelled = true }
  }, [projectDir])

  // Listen for shell terminal output to detect readiness and send pending commands
  useEffect(() => {
    const handleShellOutput = (e: Event) => {
      const { paneId } = (e as CustomEvent<{ paneId: string }>).detail
      if (readyShellsRef.current.has(paneId)) return
      readyShellsRef.current.add(paneId)

      // Check if there's a pending command for a newly created shell
      const pending = pendingCommandRef.current
      if (pending) {
        // Match by checking if the pane name matches
        const pane = useWorkspaceStore.getState().shellPanes.find((p) => p.id === paneId && p.name === pending.name)
        if (pane) {
          pendingCommandRef.current = null
          send({ type: 'terminal.input', paneId, data: `${pending.command}\r` })
        }
      }
    }
    window.addEventListener('shell-output', handleShellOutput)
    return () => window.removeEventListener('shell-output', handleShellOutput)
  }, [send])

  useEffect(() => {
    const handleCreateFailed = (e: Event) => {
      const { message } = (e as CustomEvent<{ message: string }>).detail
      setCreateError(message || 'Failed to create shell')
    }
    window.addEventListener('nexus-pane-create-failed', handleCreateFailed)
    return () => window.removeEventListener('nexus-pane-create-failed', handleCreateFailed)
  }, [])

  const createShellPane = useCallback((command?: string) => {
    const currentShells = useWorkspaceStore.getState().shellPanes
    const name = getNextShellName(currentShells)
    debugLog('bottom-terminal', 'createShellPane:requested', {
      name,
      command: command || null,
      connectionStatus,
      activeShellPaneId: useWorkspaceStore.getState().activeShellPaneId,
      shells: summarizeShells(currentShells),
    })
    setCreateError(null)
    if (connectionStatus !== 'connected') {
      debugLog('bottom-terminal', 'createShellPane:blocked-disconnected', { name, connectionStatus })
      setCreateError(`Cannot create shell while server is ${connectionStatus}`)
      return
    }
    if (command) {
      pendingCommandRef.current = { name, command }
    }
    send({
      type: 'pane.create',
      config: {
        name,
        agent: '__shell__',
        restore: 'manual',
      },
    })
    debugLog('bottom-terminal', 'createShellPane:sent', { name })
    setIsOpen(true)
  }, [connectionStatus, send])

  const handleCreateShellClick = useCallback((event?: MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault()
    event?.stopPropagation()
    debugLog('bottom-terminal', 'new-button:click', {
      connectionStatus,
      activeShellPaneId: useWorkspaceStore.getState().activeShellPaneId,
      shells: summarizeShells(useWorkspaceStore.getState().shellPanes),
    })
    createShellPane()
  }, [createShellPane])

  const runCommand = useCallback((command: string) => {
    if (!activeShellPaneId || shellPanes.length === 0) {
      createShellPane(command)
      return
    }
    setIsOpen(true)
    send({ type: 'terminal.input', paneId: activeShellPaneId, data: `${command}\r` })
  }, [send, activeShellPaneId, shellPanes.length, createShellPane])

  const handleOpen = useCallback(() => {
    if (shellPanes.length === 0) {
      createShellPane()
    }
    setIsOpen(true)
  }, [shellPanes.length, createShellPane])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setIsMaximized(false)
  }, [])

  const handleCloseShell = useCallback((paneId: string) => {
    send({ type: 'pane.close', paneId })
    clearTerminalHistory(paneId)
    readyShellsRef.current.delete(paneId)
  }, [send])

  const beginRename = useCallback((paneId: string, currentName: string) => {
    setRenamingPaneId(paneId)
    setRenameDraft(currentName)
  }, [])

  const cancelRename = useCallback(() => {
    setRenamingPaneId(null)
    setRenameDraft('')
  }, [])

  const commitRename = useCallback(() => {
    if (!renamingPaneId) return
    const trimmed = renameDraft.trim()
    const pane = shellPanes.find((p) => p.id === renamingPaneId)
    if (trimmed && pane && trimmed !== pane.name) {
      send({ type: 'pane.rename', paneId: renamingPaneId, name: trimmed })
    }
    setRenamingPaneId(null)
    setRenameDraft('')
  }, [renameDraft, renamingPaneId, send, shellPanes])

  const setAndPersistHeight = useCallback((next: number) => {
    setHeightPct(next)
    saveModeTerminalHeight(layoutMode, next)
  }, [layoutMode])

  const handleToggleMaximize = useCallback(() => {
    setIsMaximized((value) => !value)
  }, [])

  const handleResizePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (isMaximized) {
      setIsMaximized(false)
    }
    event.preventDefault()
    const parentHeight = panelRef.current?.parentElement?.clientHeight || window.innerHeight
    const startY = event.clientY
    const startPct = heightPct
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'

    const handlePointerMove = (ev: PointerEvent) => {
      const deltaPct = ((startY - ev.clientY) / Math.max(parentHeight, 1)) * 100
      const next = Math.max(18, Math.min(78, startPct + deltaPct))
      setHeightPct(next)
    }

    const handlePointerUp = (ev: PointerEvent) => {
      const deltaPct = ((startY - ev.clientY) / Math.max(parentHeight, 1)) * 100
      const next = Math.max(18, Math.min(78, startPct + deltaPct))
      setAndPersistHeight(next)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
  }, [heightPct, isMaximized, setAndPersistHeight])

  const commandButtons = [...STATIC_COMMANDS, ...projectCommands]
  const terminalHeight = isMaximized ? 'calc(100% - var(--header-height))' : `${heightPct}%`
  const changeCount = gitDiffs.length + gitStagedDiffs.length
  const separator = <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>/</span>
  const renderAirline = () => (
    <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden', gap: 8 }}>
      <AirSegment color="var(--text-muted)" title={projectDir || 'Workspace'}>
        <Folder style={{ width: 12, height: 12 }} />
        {basename(projectDir)}
      </AirSegment>
      {separator}
      <AirSegment color="var(--text-muted)" title={gitBranchInfo?.remote ? `${gitBranchInfo.branch} -> ${gitBranchInfo.remote}` : gitBranchInfo?.branch || 'No git branch'}>
        <GitBranch style={{ width: 12, height: 12 }} />
        {gitBranchInfo?.branch || 'no-git'}
        {gitBranchInfo && gitBranchInfo.ahead > 0 && <span>+{gitBranchInfo.ahead}</span>}
        {gitBranchInfo && gitBranchInfo.behind > 0 && <span>-{gitBranchInfo.behind}</span>}
      </AirSegment>
      {separator}
      <AirSegment color="var(--text-muted)" title={`${gitStagedDiffs.length} staged, ${gitDiffs.length} unstaged`}>
        <GitCompare style={{ width: 12, height: 12 }} />
        {changeCount} changes
      </AirSegment>
    </div>
  )
  const renderShellList = () => (
    <div
      style={{
        width: 176,
        flexShrink: 0,
        borderRight: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: TERMINAL_COMMAND_BAR_HEIGHT,
          minHeight: TERMINAL_COMMAND_BAR_HEIGHT,
          padding: '0 8px',
          fontSize: 'var(--font-xs)',
          color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border-subtle)',
          boxSizing: 'border-box',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <button
            type="button"
            className="pane-action-btn bottom-terminal-instance-action"
            title="New terminal"
            aria-label="New terminal"
            data-label="New shell"
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={handleCreateShellClick}
            disabled={connectionStatus !== 'connected'}
            style={{
              cursor: connectionStatus === 'connected' ? 'pointer' : 'not-allowed',
              opacity: connectionStatus === 'connected' ? 1 : 0.45,
            }}
          >
            <Plus className="icon-xs" style={{ color: 'var(--text-secondary)' }} />
          </button>
          {activeShellPaneId && (
            <>
              <button type="button" className="pane-action-btn bottom-terminal-instance-action" title="Interrupt current command" aria-label="Interrupt current command" data-label="Interrupt" onClick={() => send({ type: 'terminal.input', paneId: activeShellPaneId, data: '\u0003' })}>
                <Square className="icon-xs" style={{ color: 'var(--text-secondary)' }} />
              </button>
              <button type="button" className="pane-action-btn bottom-terminal-instance-action" title="Clear terminal" aria-label="Clear terminal" data-label="Clear" onClick={() => send({ type: 'terminal.input', paneId: activeShellPaneId, data: 'clear\r' })}>
                <Eraser className="icon-xs" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </>
          )}
        </div>
      </div>
      {shellPanes.length === 0 ? (
        <div
          style={{
            padding: '12px',
            fontSize: 'var(--font-xs)',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}
        >
          No shells yet
        </div>
      ) : (
        shellPanes.map((pane) => {
          const isRenaming = renamingPaneId === pane.id
          return (
            <div
              key={pane.id}
              className="shell-instance-row"
              onClick={() => !isRenaming && setActiveShellPaneId(pane.id)}
              title={isRenaming ? undefined : pane.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                cursor: isRenaming ? 'text' : 'pointer',
                fontSize: 'var(--font-xs)',
                color: activeShellPaneId === pane.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: activeShellPaneId === pane.id ? 'var(--bg-elevated)' : 'transparent',
                borderLeft: activeShellPaneId === pane.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              }}
            >
              <TerminalIcon style={{ width: 12, height: 12, flexShrink: 0 }} />
              {isRenaming ? (
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitRename()
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      cancelRename()
                    }
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: 'var(--bg-base)',
                    border: '1px solid var(--accent-primary)',
                    borderRadius: 3,
                    color: 'var(--text-primary)',
                    fontSize: 'var(--font-xs)',
                    fontFamily: 'inherit',
                    padding: '1px 4px',
                    outline: 'none',
                  }}
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    beginRename(pane.id, pane.name)
                  }}
                  style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {pane.name}
                </span>
              )}
              {!isRenaming && (
                <button
                  type="button"
                  className="shell-row-action"
                  title="Rename terminal"
                  onClick={(e) => {
                    e.stopPropagation()
                    beginRename(pane.id, pane.name)
                  }}
                >
                  <Pencil style={{ width: 11, height: 11 }} />
                </button>
              )}
              <button
                type="button"
                className="shell-row-action"
                title="Close terminal"
                onClick={(e) => {
                  e.stopPropagation()
                  handleCloseShell(pane.id)
                }}
              >
                <X style={{ width: 11, height: 11 }} />
              </button>
            </div>
          )
        })
      )}
      {createError && (
        <div style={{ margin: 8, padding: 8, borderRadius: 6, color: 'var(--status-error)', background: 'color-mix(in srgb, var(--status-error) 10%, transparent)', fontSize: 'var(--font-xs)', lineHeight: 1.4 }}>
          {createError}
        </div>
      )}
    </div>
  )

  // Collapsed bar
  if (!isOpen) {
    return (
      <div
        style={{
          flexShrink: 0,
          width: '100%',
          height: 'var(--header-height)',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--space-lg)',
          gap: 'var(--space-md)',
          cursor: 'pointer',
        }}
        onClick={handleOpen}
      >
        <TerminalIcon className="icon-sm" style={{ color: 'var(--text-primary)' }} />
        <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>Terminal</span>
        <div style={{ marginLeft: 'var(--space-lg)', minWidth: 0 }}>
          {renderAirline()}
        </div>
      </div>
    )
  }

  // Expanded terminal panel
  return (
    <div
      ref={panelRef}
      style={{
        flexShrink: 0,
        width: '100%',
        height: terminalHeight,
        minHeight: 'var(--header-height)',
        background: 'var(--bg-base)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <div
        className="bottom-terminal-resize-hitbox"
        onPointerDown={handleResizePointerDown}
        title="Drag to resize terminal"
      />
      {/* Header bar */}
      <BottomTerminalHeader
        isMaximized={isMaximized}
        onClose={handleClose}
        onToggleMaximize={handleToggleMaximize}
        airline={renderAirline()}
      />

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {renderShellList()}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Command chips */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: TERMINAL_COMMAND_BAR_HEIGHT,
              minHeight: TERMINAL_COMMAND_BAR_HEIGHT,
              padding: '6px 12px',
              borderBottom: '1px solid var(--border-subtle)',
              boxSizing: 'border-box',
              background: 'var(--bg-elevated)',
              overflowX: 'auto',
              flexShrink: 0,
            }}
          >
            {commandButtons.map((command) => (
              <button
                key={command}
                className="terminal-chip"
                onClick={() => runCommand(command)}
              >
                {command}
              </button>
            ))}
            <button className="terminal-chip" onClick={() => activeShellPaneId && send({ type: 'terminal.input', paneId: activeShellPaneId, data: '--help' })}>
              --help
            </button>
            <button className="terminal-chip" onClick={() => activeShellPaneId && send({ type: 'terminal.input', paneId: activeShellPaneId, data: '--watch' })}>
              --watch
            </button>
          </div>

          {/* Terminal area */}
          <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            {shellPanes.map((pane) => (
              <div
                key={pane.id}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: activeShellPaneId === pane.id ? 'block' : 'none',
                }}
              >
                <Terminal
                  paneId={pane.id}
                  onData={(data) => send({ type: 'terminal.input', paneId: pane.id, data })}
                  onResize={(cols, rows) => send({ type: 'terminal.resize', paneId: pane.id, cols, rows })}
                />
              </div>
            ))}
            {shellPanes.length === 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--text-muted)',
                  fontSize: 'var(--font-sm)',
                }}
              >
                No terminal instances
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
