import type { CSSProperties } from 'react'
import type { ITerminalOptions } from '@xterm/xterm'

import type { TerminalId, TerminalViewport, TuiTerminalRuntime } from '../core/types'

export interface TuiTerminalProps {
  terminalId: TerminalId
  runtime: TuiTerminalRuntime
  visible?: boolean
  options?: ITerminalOptions
  className?: string
  style?: CSSProperties
  onInput?: (data: string) => void
  onResize?: (viewport: TerminalViewport) => void
}
