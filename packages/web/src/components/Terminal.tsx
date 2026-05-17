import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { registerTerminalWriter, unregisterTerminalWriter } from '@/stores/terminalRegistry'
import { createTuiTerminalRuntime, type TuiTerminalSession } from '@mexus/terminal'

interface TerminalProps {
  paneId: string
  visible?: boolean
  bufferWhenHidden?: boolean
  onData: (data: string) => void
  onResize: (cols: number, rows: number) => void
}

const terminalRuntime = createTuiTerminalRuntime()

function resolveCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function Terminal({ paneId, visible = true, bufferWhenHidden = true, onData, onResize }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const sessionRef = useRef<TuiTerminalSession | null>(null)
  const onDataRef = useRef(onData)
  const onResizeRef = useRef(onResize)
  const visibleRef = useRef(visible)
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep refs up to date without re-running the effect
  onDataRef.current = onData
  onResizeRef.current = onResize
  visibleRef.current = visible

  useEffect(() => {
    sessionRef.current?.setVisibility(!bufferWhenHidden || visible ? 'visible' : 'hidden')
  }, [bufferWhenHidden, visible])

  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
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
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(containerRef.current)

    const session = terminalRuntime.getTerminal(paneId) ?? terminalRuntime.createTerminal({ id: paneId })
    session.attach(term, fitAddon)
    session.setVisibility(!bufferWhenHidden || visibleRef.current ? 'visible' : 'hidden')

    // Initial fit — only if container is visible (not collapsed)
    requestAnimationFrame(() => {
      if (visibleRef.current && containerRef.current && containerRef.current.clientHeight > 0) {
        fitAddon.fit()
        term.refresh(0, Math.max(0, term.rows - 1))
        onResizeRef.current(term.cols, term.rows)
        term.focus()
      }
    })

    // Forward keyboard input to server
    term.onData((data) => {
      onDataRef.current(data)
    })

    // Register write function + xterm + fitAddon for external control
    registerTerminalWriter(
      paneId,
      (data: string) => {
        session.writeLive(data)
      },
      term,
      fitAddon,
    )

    termRef.current = term
    fitRef.current = fitAddon
    sessionRef.current = session

    const handleTerminalFontChanged = () => {
      const fontFamily = resolveCssVar('--font-mono')
      if (!fontFamily) return

      term.options.fontFamily = fontFamily
      requestAnimationFrame(() => {
        if (!visibleRef.current || !containerRef.current || containerRef.current.clientHeight <= 0) return
        fitAddon.fit()
        term.refresh(0, Math.max(0, term.rows - 1))
        onResizeRef.current(term.cols, term.rows)
      })
    }

    window.addEventListener('nexus:terminal-font-changed', handleTerminalFontChanged)

    // Resize observer — debounced to avoid excessive resize events during drag
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current)
      }
      resizeTimerRef.current = setTimeout(() => {
        if (visibleRef.current && fitRef.current && containerRef.current && containerRef.current.clientHeight > 0) {
          fitRef.current.fit()
          if (termRef.current) {
            termRef.current.refresh(0, Math.max(0, termRef.current.rows - 1))
            onResizeRef.current(termRef.current.cols, termRef.current.rows)
          }
        }
      }, 50)
    })

    resizeObserver.observe(containerRef.current)

    return () => {
      window.removeEventListener('nexus:terminal-font-changed', handleTerminalFontChanged)
      resizeObserver.disconnect()
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current)
      }
      unregisterTerminalWriter(paneId)
      session.detach()
      term.dispose()
      termRef.current = null
      fitRef.current = null
      sessionRef.current = null
    }
  }, [paneId])

  return (
    <div
      ref={containerRef}
      className="terminal-container"
      tabIndex={-1}
      onPointerDown={() => {
        termRef.current?.focus()
      }}
      onWheel={(event) => {
        event.stopPropagation()
      }}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
      }}
    />
  )
}
