import { useState, useCallback, useEffect, useRef } from 'react'
import { Terminal as TerminalIcon, ChevronDown, ChevronUp, Maximize2, Minimize2, RotateCcw, RefreshCw, Square, Eraser, Plus, X } from 'lucide-react'
import { Terminal } from './Terminal'
import type { ClientEvent } from '@/types'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { clearTerminalHistory, pauseTerminal, resumeTerminal, refitTerminal } from '@/stores/terminalRegistry'
import {
  DEFAULT_TERMINAL_HEIGHTS,
  LAYOUT_EVENT,
  TERMINAL_HEIGHT_STEPS,
  cycleStep,
  loadLayoutPreferences,
  saveModeTerminalHeight,
  type LayoutMode,
} from '@/lib/layoutPreferences'
import { getProjectCommands } from '@/lib/terminalCommands'

interface BottomTerminalProps {
  send: (event: ClientEvent) => void
}

const STATIC_COMMANDS = ['pwd', 'ls', 'git status', 'git diff --stat', 'git push']

let shellCounter = 0

function getNextShellName(): string {
  return `Shell ${++shellCounter}`
}

export function BottomTerminal({ send }: BottomTerminalProps) {
  const initialPrefs = loadLayoutPreferences()
  const [isOpen, setIsOpen] = useState(false)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(initialPrefs.mode)
  const [heightPct, setHeightPct] = useState(initialPrefs.terminalHeightByMode[initialPrefs.mode])
  const [isMaximized, setIsMaximized] = useState(false)
  const [projectCommands, setProjectCommands] = useState<string[]>([])
  const [lastCommand, setLastCommand] = useState<string | null>(null)

  // Pending commands: when a shell is created with a command, we wait for shell output before sending
  const pendingCommandRef = useRef<{ name: string; command: string } | null>(null)
  // Track shell panes that have received output (prompt is ready)
  const readyShellsRef = useRef<Set<string>>(new Set())

  const shellPanes = useWorkspaceStore((s) => s.shellPanes)
  const activeShellPaneId = useWorkspaceStore((s) => s.activeShellPaneId)
  const setActiveShellPaneId = useWorkspaceStore((s) => s.setActiveShellPaneId)

  // Initialize shell counter from existing shells (e.g., after reconnect)
  useEffect(() => {
    for (const pane of shellPanes) {
      const match = pane.name.match(/^Shell (\d+)$/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > shellCounter) shellCounter = num
      }
      // Mark existing shells as ready (they've already been outputting)
      readyShellsRef.current.add(pane.id)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Pause/resume terminals when switching active instance
  const prevActiveRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevActiveRef.current
    if (prev && prev !== activeShellPaneId) {
      pauseTerminal(prev)
    }
    if (activeShellPaneId && activeShellPaneId !== prev) {
      resumeTerminal(activeShellPaneId)
      // Refit after a tick to ensure dimensions are correct
      requestAnimationFrame(() => refitTerminal(activeShellPaneId))
    }
    prevActiveRef.current = activeShellPaneId
  }, [activeShellPaneId])

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

  // Load project commands
  useEffect(() => {
    fetch('/api/file?path=package.json')
      .then((res) => res.ok ? res.json() : null)
      .then((data: { content: string } | null) => {
        if (!data?.content) return
        const parsed = JSON.parse(data.content) as { scripts?: Record<string, string> }
        setProjectCommands(getProjectCommands(parsed.scripts || {}))
      })
      .catch(() => setProjectCommands([]))
  }, [])

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

  const createShellPane = useCallback((command?: string) => {
    const name = getNextShellName()
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
    setIsOpen(true)
  }, [send])

  const runCommand = useCallback((command: string) => {
    if (!activeShellPaneId || shellPanes.length === 0) {
      createShellPane(command)
      setLastCommand(command)
      return
    }
    setIsOpen(true)
    send({ type: 'terminal.input', paneId: activeShellPaneId, data: `${command}\r` })
    setLastCommand(command)
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

  const setAndPersistHeight = useCallback((next: number) => {
    setHeightPct(next)
    saveModeTerminalHeight(layoutMode, next)
  }, [layoutMode])

  const handleCycleHeight = useCallback(() => {
    if (isMaximized) {
      setIsMaximized(false)
    }
    setAndPersistHeight(cycleStep(TERMINAL_HEIGHT_STEPS, heightPct))
  }, [heightPct, isMaximized, setAndPersistHeight])

  const handleResetHeight = useCallback(() => {
    setIsMaximized(false)
    setAndPersistHeight(DEFAULT_TERMINAL_HEIGHTS[layoutMode])
  }, [layoutMode, setAndPersistHeight])

  const handleToggleMaximize = useCallback(() => {
    setIsMaximized((value) => !value)
  }, [])

  const commandButtons = [...STATIC_COMMANDS, ...projectCommands]
  const terminalHeight = isMaximized ? 'calc(100vh - var(--header-height) * 2)' : `${heightPct}vh`

  // Collapsed bar
  if (!isOpen) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 'var(--sidebar-width)',
          right: 0,
          height: 'var(--header-height)',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--space-lg)',
          gap: 'var(--space-md)',
          zIndex: 10,
          cursor: 'pointer',
        }}
        onClick={handleOpen}
      >
        <TerminalIcon className="icon-sm" style={{ color: 'var(--text-secondary)' }} />
        <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>Terminal</span>
        {shellPanes.length > 0 && (
          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
            ({shellPanes.length})
          </span>
        )}
        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{heightPct}vh</span>
        <ChevronUp className="icon-sm" style={{ color: 'var(--text-muted)', marginLeft: 'auto' }} />
      </div>
    )
  }

  // Expanded terminal panel
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 'var(--sidebar-width)',
        right: 0,
        height: terminalHeight,
        background: 'var(--bg-base)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
      }}
    >
      {/* Header bar */}
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
        <TerminalIcon className="icon-sm" style={{ color: 'var(--text-secondary)' }} />
        <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>Terminal</span>
        <button className="pane-action-btn" title={`Height ${heightPct}vh`} onClick={handleCycleHeight}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 28 }}>{heightPct}vh</span>
        </button>
        <button className="pane-action-btn" title="Reset height" onClick={handleResetHeight}>
          <RotateCcw className="icon-xs" style={{ color: 'var(--text-secondary)' }} />
        </button>
        {activeShellPaneId && (
          <>
            <button className="pane-action-btn" title="Interrupt current command" onClick={() => send({ type: 'terminal.input', paneId: activeShellPaneId, data: '\u0003' })}>
              <Square className="icon-xs" style={{ color: 'var(--text-secondary)' }} />
            </button>
            <button className="pane-action-btn" title="Clear terminal" onClick={() => send({ type: 'terminal.input', paneId: activeShellPaneId, data: 'clear\r' })}>
              <Eraser className="icon-xs" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </>
        )}
        <button className="pane-action-btn" title="Retry last command" onClick={() => lastCommand && runCommand(lastCommand)} disabled={!lastCommand}>
          <RefreshCw className="icon-xs" style={{ color: lastCommand ? 'var(--text-secondary)' : 'var(--text-muted)' }} />
        </button>
        <button className="pane-action-btn" title="New terminal" onClick={() => createShellPane()}>
          <Plus className="icon-xs" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-xs)' }}>
          <button className="pane-action-btn" title={isMaximized ? 'Restore terminal' : 'Maximize terminal'} onClick={handleToggleMaximize}>
            {isMaximized ? (
              <Minimize2 className="icon-xs" style={{ color: 'var(--accent-primary)' }} />
            ) : (
              <Maximize2 className="icon-xs" style={{ color: 'var(--text-secondary)' }} />
            )}
          </button>
          <button className="pane-action-btn" title="Minimize terminal" onClick={handleClose}>
            <ChevronDown className="icon-sm" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
      </div>

      {/* Command chips */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderBottom: '1px solid var(--border-subtle)',
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

      {/* Main content: terminal + instance list */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
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

        {/* Instance list (right side) */}
        {shellPanes.length > 0 && (
          <div
            style={{
              width: 160,
              flexShrink: 0,
              borderLeft: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '6px 8px',
                fontSize: 'var(--font-xs)',
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border-subtle)',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Instances</span>
              <button
                className="pane-action-btn"
                title="New terminal"
                onClick={() => createShellPane()}
                style={{ padding: 2 }}
              >
                <Plus style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
              </button>
            </div>
            {shellPanes.map((pane) => (
              <div
                key={pane.id}
                onClick={() => setActiveShellPaneId(pane.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 8px',
                  cursor: 'pointer',
                  fontSize: 'var(--font-xs)',
                  color: activeShellPaneId === pane.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: activeShellPaneId === pane.id ? 'var(--bg-elevated)' : 'transparent',
                  borderLeft: activeShellPaneId === pane.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                }}
              >
                <TerminalIcon style={{ width: 12, height: 12, flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pane.name}
                </span>
                <button
                  className="pane-action-btn"
                  title="Close terminal"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCloseShell(pane.id)
                  }}
                  style={{ padding: 2, opacity: 0.6 }}
                >
                  <X style={{ width: 10, height: 10 }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
