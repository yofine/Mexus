import { useEffect, useRef } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal as XTerm } from '@xterm/xterm'

import type { TuiTerminalSession } from '../core/types'
import type { TuiTerminalProps } from './types'

function hasSize(element: HTMLElement): boolean {
  return element.clientWidth > 0 && element.clientHeight > 0
}

export function TuiTerminal({
  terminalId,
  runtime,
  visible = true,
  options,
  className,
  style,
  onInput,
  onResize,
}: TuiTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const sessionRef = useRef<TuiTerminalSession | null>(null)
  const onInputRef = useRef(onInput)
  const onResizeRef = useRef(onResize)
  const visibleRef = useRef(visible)

  onInputRef.current = onInput
  onResizeRef.current = onResize
  visibleRef.current = visible

  useEffect(() => {
    const session = sessionRef.current
    if (!session) return

    session.setVisibility(visible ? 'visible' : 'hidden')
  }, [visible])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new XTerm(options)
    const fitAddon = new FitAddon()
    const session = runtime.getTerminal(terminalId) ?? runtime.createTerminal({ id: terminalId })

    term.loadAddon(fitAddon)
    term.open(container)
    session.attach(term, fitAddon)
    session.setVisibility(visibleRef.current ? 'visible' : 'hidden')

    const inputDisposable = term.onData((data) => {
      onInputRef.current?.(data)
    })

    termRef.current = term
    sessionRef.current = session

    const fitAndNotify = () => {
      if (!hasSize(container)) return

      session.fit()
      session.refresh()

      const viewport = session.getViewport()
      if (viewport) {
        onResizeRef.current?.(viewport)
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
      sessionRef.current = null
    }
  }, [terminalId, runtime, options])

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      onPointerDown={() => {
        termRef.current?.focus()
      }}
    />
  )
}
