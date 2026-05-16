import type { ReplayKind } from '../../core/types'

export interface MexusTerminalEventBase {
  paneId: string
  sessionKey?: string | null
  cols?: number | null
}

export interface MexusTerminalOutputEvent extends MexusTerminalEventBase {
  type: 'terminal.output'
  data: string
}

export interface MexusTerminalReplayStartEvent extends MexusTerminalEventBase {
  type: 'terminal.replay.start'
  replayId?: string
  kind?: ReplayKind
}

export interface MexusTerminalReplayChunkEvent extends MexusTerminalEventBase {
  type: 'terminal.replay.chunk'
  replayId?: string
  data: string
}

export interface MexusTerminalReplayEndEvent extends MexusTerminalEventBase {
  type: 'terminal.replay.end'
  replayId?: string
}

export type MexusTerminalServerEvent =
  | MexusTerminalOutputEvent
  | MexusTerminalReplayStartEvent
  | MexusTerminalReplayChunkEvent
  | MexusTerminalReplayEndEvent

export interface MexusTerminalIdentity {
  workspaceKey: string
  paneId: string
  sessionKey?: string | null
  cols: number
}

export interface MexusResolvedTerminalLaunchRequest {
  paneId: string
  command: string
  autoExecute?: boolean
}
