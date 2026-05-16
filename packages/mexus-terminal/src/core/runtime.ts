import type {
  CreateTerminalOptions,
  TerminalId,
  TuiTerminalRuntime,
  TuiTerminalSession as TuiTerminalSessionContract,
} from './types'
import { TuiTerminalSession } from './terminal-session'

export function createTuiTerminalRuntime(): TuiTerminalRuntime {
  return new TuiTerminalRuntimeImpl()
}

class TuiTerminalRuntimeImpl implements TuiTerminalRuntime {
  private readonly sessions = new Map<TerminalId, TuiTerminalSessionContract>()

  createTerminal(options: CreateTerminalOptions): TuiTerminalSessionContract {
    this.disposeTerminal(options.id)

    const session = new TuiTerminalSession(options.id)
    this.sessions.set(options.id, session)

    if (options.xterm) {
      session.attach(options.xterm, options.fitAddon)
    }

    return session
  }

  getTerminal(id: TerminalId): TuiTerminalSessionContract | undefined {
    return this.sessions.get(id)
  }

  disposeTerminal(id: TerminalId): void {
    const session = this.sessions.get(id)
    if (!session) {
      return
    }

    session.dispose()
    this.sessions.delete(id)
  }

  dispose(): void {
    for (const id of [...this.sessions.keys()]) {
      this.disposeTerminal(id)
    }
  }
}
