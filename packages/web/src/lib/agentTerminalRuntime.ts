import {
  createMexusTerminalAdapter,
  createTuiTerminalRuntime,
  type MexusTerminalAdapter,
  type MexusTerminalServerEvent,
  type TuiTerminalRuntime,
} from '@mexus/terminal'

let runtime: TuiTerminalRuntime = createTuiTerminalRuntime()
let adapter: MexusTerminalAdapter | null = null

export function getAgentTerminalRuntime(): TuiTerminalRuntime {
  return runtime
}

export function resetAgentTerminalRuntime(workspaceKey: string, activePaneId: string | null = null): MexusTerminalAdapter {
  adapter?.resetWorkspace()
  runtime.dispose()
  runtime = createTuiTerminalRuntime()
  adapter = createMexusTerminalAdapter({
    runtime,
    workspaceKey,
    activePaneId,
  })
  return adapter
}

export function getAgentTerminalAdapter(workspaceKey: string, activePaneId: string | null = null): MexusTerminalAdapter {
  if (!adapter) {
    adapter = createMexusTerminalAdapter({
      runtime,
      workspaceKey,
      activePaneId,
    })
  }
  return adapter
}

export function setAgentTerminalActivePane(paneId: string | null): void {
  adapter?.setActivePane(paneId)
}

export function handleAgentTerminalEvent(
  workspaceKey: string,
  activePaneId: string | null,
  event: MexusTerminalServerEvent,
): void {
  getAgentTerminalAdapter(workspaceKey, activePaneId).handleEvent(event)
}
