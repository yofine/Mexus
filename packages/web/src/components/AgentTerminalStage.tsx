import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import type { ITerminalOptions } from '@xterm/xterm'
import { TuiTerminalStage } from '@mexus/terminal'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

import type { ClientEvent, PaneState } from '@/types'
import type { TuiTerminalRuntime, TuiTerminalSession } from '@mexus/terminal'
import { getAgentTerminalRuntime } from '@/lib/agentTerminalRuntime'

interface AgentTerminalStageProps {
  panes: PaneState[]
  activePaneId: string | null
  send: (event: ClientEvent) => void
}

function resolveCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function getTerminalOptions(): ITerminalOptions {
  return {
    cursorBlink: true,
    fontSize: 13,
    fontFamily: resolveCssVar('--font-mono') || "'Geist Mono', 'JetBrains Mono', monospace",
    allowProposedApi: true,
    scrollback: 5000,
    theme: {
      background: resolveCssVar('--term-bg'),
      foreground: resolveCssVar('--term-fg'),
      cursor: resolveCssVar('--term-cursor'),
      selectionBackground: resolveCssVar('--term-selection'),
    },
  }
}

export function AgentTerminalStage({ panes, activePaneId, send }: AgentTerminalStageProps) {
  const terminalRuntime = getAgentTerminalRuntime()
  const sessionIds = useMemo(
    () => panes.filter((pane) => pane.agent !== '__shell__').map((pane) => pane.id),
    [panes],
  )
  const terminalOptions = useMemo(getTerminalOptions, [])

  const handleInput = useCallback(
    (paneId: string, data: string) => {
      send({ type: 'terminal.input', paneId, data })
    },
    [send],
  )

  const handleResize = useCallback(
    (paneId: string, viewport: { cols: number; rows: number }) => {
      send({ type: 'terminal.resize', paneId, cols: viewport.cols, rows: viewport.rows })
    },
    [send],
  )

  return (
    <TuiTerminalStage
      sessionIds={sessionIds}
      activeSessionId={activePaneId}
      runtime={terminalRuntime}
      terminalOptions={terminalOptions}
      className="agent-terminal-stage"
      terminalClassName="terminal-container"
      renderTerminal={({ sessionId, active, className, style }) => (
        <StageTerminalLayer
          paneId={sessionId}
          active={active}
          className={className}
          style={style}
          options={terminalOptions}
          runtime={terminalRuntime}
          onInput={handleInput}
          onResize={handleResize}
        />
      )}
    />
  )
}

function StageTerminalLayer({
  paneId,
  active,
  className,
  style,
  options,
  runtime,
  onInput,
  onResize,
}: {
  paneId: string
  active: boolean
  className?: string
  style?: CSSProperties
  options: ITerminalOptions
  runtime: TuiTerminalRuntime
  onInput: (paneId: string, data: string) => void
  onResize: (paneId: string, viewport: { cols: number; rows: number }) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const sessionRef = useRef<TuiTerminalSession | null>(null)
  const activeRef = useRef(active)
  const onInputRef = useRef(onInput)
  const onResizeRef = useRef(onResize)

  activeRef.current = active
  onInputRef.current = onInput
  onResizeRef.current = onResize

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new XTerm(options)
    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    const session = runtime.getTerminal(paneId) ?? runtime.createTerminal({ id: paneId })

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(container)
    session.attach(term, fitAddon)
    session.setVisibility('visible')

    const inputDisposable = term.onData((data) => {
      if (activeRef.current) {
        onInputRef.current(paneId, data)
      }
    })

    termRef.current = term
    fitRef.current = fitAddon
    sessionRef.current = session

    const fitAndNotify = () => {
      if (!activeRef.current || container.clientWidth <= 0 || container.clientHeight <= 0) return

      session.fit()
      session.refresh()
      const viewport = session.getViewport()
      if (viewport) {
        onResizeRef.current(paneId, viewport)
      }
    }

    requestAnimationFrame(fitAndNotify)

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(fitAndNotify)
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      inputDisposable.dispose()
      session.detach()
      term.dispose()
      termRef.current = null
      fitRef.current = null
      sessionRef.current = null
    }
  }, [options, paneId, runtime])

  useEffect(() => {
    sessionRef.current?.setVisibility('visible')
    if (!active) return

    requestAnimationFrame(() => {
      fitRef.current?.fit()
      termRef.current?.refresh(0, Math.max(0, termRef.current.rows - 1))
      termRef.current?.focus()
      const viewport = sessionRef.current?.getViewport()
      if (viewport) {
        onResizeRef.current(paneId, viewport)
      }
    })
  }, [active, paneId])

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      tabIndex={-1}
      onPointerDown={() => {
        if (active) termRef.current?.focus()
      }}
      onWheel={(event) => {
        event.stopPropagation()
      }}
    />
  )
}
