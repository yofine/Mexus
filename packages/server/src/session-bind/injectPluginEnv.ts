// Pure function: given a pane and an issued bind token, return the additional
// CLI args and environment variables that should be appended/merged when
// spawning the agent so the Mexus plugin loads and can call back.
//
// This module is sidecar-only and NOT yet called by PtyManager. Once the
// session-bind module is verified end-to-end, PtyManager.spawn will adopt it.

import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface PluginEnvPatch {
  cliArgs: string[]
  env: Record<string, string>
}

export interface InjectPluginEnvInput {
  paneId: string
  agent: string
  bindUrl: string
  paneToken: string
  debug?: boolean
  pluginDir?: string // override for tests
}

// Agents that have a verified plugin/hook surface.
const SUPPORTED_AGENTS = new Set(['claudecode'])

export function resolvePluginDir(): string {
  // From dist or src: packages/server/{dist|src}/session-bind/<this file>
  // Target:           packages/mexus-plugin
  const here = path.dirname(fileURLToPath(import.meta.url))
  // .../packages/server/<src|dist>/session-bind -> .../packages/mexus-plugin
  return path.resolve(here, '..', '..', '..', 'mexus-plugin')
}

export function injectPluginEnv(input: InjectPluginEnvInput): PluginEnvPatch {
  if (!SUPPORTED_AGENTS.has(input.agent)) {
    return { cliArgs: [], env: {} }
  }

  const pluginDir = input.pluginDir ?? resolvePluginDir()
  const env: Record<string, string> = {
    MEXUS_PANE_ID: input.paneId,
    MEXUS_BIND_URL: input.bindUrl,
    MEXUS_BIND_TOKEN: input.paneToken,
  }
  if (input.debug) env.MEXUS_PLUGIN_DEBUG = '1'

  return {
    cliArgs: ['--plugin-dir', pluginDir],
    env,
  }
}
