import type { MexusResolvedTerminalLaunchRequest } from './types'

export interface CreateMexusTerminalLaunchAdapterOptions {
  writeInput: (paneId: string, data: string) => void | Promise<void>
}

interface ReadyWaiter {
  resolve(): void
  reject(error: Error): void
}

export class MexusTerminalLaunchAdapter {
  private readonly writeInput: CreateMexusTerminalLaunchAdapterOptions['writeInput']
  private readonly readyPaneIds = new Set<string>()
  private readonly rejectedPaneIds = new Map<string, Error>()
  private readonly waiters = new Map<string, Set<ReadyWaiter>>()

  constructor(options: CreateMexusTerminalLaunchAdapterOptions) {
    this.writeInput = options.writeInput
  }

  markTerminalReady(paneId: string): void {
    this.rejectedPaneIds.delete(paneId)
    this.readyPaneIds.add(paneId)

    const waiters = this.waiters.get(paneId)
    if (!waiters) {
      return
    }
    this.waiters.delete(paneId)
    for (const waiter of waiters) {
      waiter.resolve()
    }
  }

  rejectTerminalReady(paneId: string, error: Error): void {
    this.readyPaneIds.delete(paneId)
    this.rejectedPaneIds.set(paneId, error)

    const waiters = this.waiters.get(paneId)
    if (!waiters) {
      return
    }
    this.waiters.delete(paneId)
    for (const waiter of waiters) {
      waiter.reject(error)
    }
  }

  waitForTerminalReady(paneId: string): Promise<void> {
    if (this.readyPaneIds.has(paneId)) {
      return Promise.resolve()
    }

    const rejected = this.rejectedPaneIds.get(paneId)
    if (rejected) {
      return Promise.reject(rejected)
    }

    return new Promise((resolve, reject) => {
      const waiters = this.waiters.get(paneId) ?? new Set<ReadyWaiter>()
      waiters.add({ resolve, reject })
      this.waiters.set(paneId, waiters)
    })
  }

  async launchResolvedTerminalAgent(
    request: MexusResolvedTerminalLaunchRequest,
  ): Promise<void> {
    await this.waitForTerminalReady(request.paneId)
    await this.writeInput(request.paneId, this.getWritableCommand(request))
  }

  private getWritableCommand(request: MexusResolvedTerminalLaunchRequest): string {
    if (request.autoExecute === false) {
      return request.command
    }
    return request.command.endsWith('\r') ? request.command : `${request.command}\r`
  }
}
