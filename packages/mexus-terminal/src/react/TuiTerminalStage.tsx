import type { CSSProperties, ReactNode } from 'react'
import type { ITerminalOptions } from '@xterm/xterm'

import { MexusPaneTerminal } from '../adapters/mexus/MexusPaneTerminal'
import type {
  TerminalId,
  TerminalViewport,
  TuiTerminalRuntime,
} from '../core/types'
import {
  getTerminalStageLayerStyle,
  getTerminalStageRootStyle,
} from './stage-layout'

export interface TuiTerminalStageProps {
  sessionIds: TerminalId[]
  activeSessionId: TerminalId | null
  runtime: TuiTerminalRuntime
  terminalOptions?: ITerminalOptions
  className?: string
  style?: CSSProperties
  terminalClassName?: string
  renderTerminal?: (props: TuiTerminalStageRenderProps) => ReactNode
  onInput?: (sessionId: TerminalId, data: string) => void
  onResize?: (sessionId: TerminalId, viewport: TerminalViewport) => void
}

export interface TuiTerminalStageRenderProps {
  sessionId: TerminalId
  active: boolean
  className?: string
  style: CSSProperties
}

export function TuiTerminalStage({
  sessionIds,
  activeSessionId,
  runtime,
  terminalOptions,
  className,
  style,
  terminalClassName,
  renderTerminal,
  onInput,
  onResize,
}: TuiTerminalStageProps) {
  return (
    <div
      className={className}
      style={{ ...getTerminalStageRootStyle(), ...style }}
      data-active-session-id={activeSessionId ?? ''}
    >
      {sessionIds.map((sessionId) => {
        const active = sessionId === activeSessionId
        return (
          <div
            key={sessionId}
            data-terminal-stage-layer={sessionId}
            data-active={String(active)}
            style={getTerminalStageLayerStyle(active)}
          >
            {renderTerminal ? renderTerminal({
              sessionId,
              active,
              className: terminalClassName,
              style: { width: '100%', height: '100%', minHeight: 0 },
            }) : (
              <MexusPaneTerminal
                paneId={sessionId}
                runtime={runtime}
                visible
                active={active}
                options={terminalOptions}
                className={terminalClassName}
                style={{ width: '100%', height: '100%', minHeight: 0 }}
                onInput={(data) => {
                  if (active) onInput?.(sessionId, data)
                }}
                onResize={(viewport) => {
                  if (active) onResize?.(sessionId, viewport)
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
