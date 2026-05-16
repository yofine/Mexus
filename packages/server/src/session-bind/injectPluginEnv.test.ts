import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { injectPluginEnv, resolvePluginDir } from './injectPluginEnv.ts'

describe('injectPluginEnv', () => {
  it('returns an empty patch for unsupported agents', () => {
    expect(injectPluginEnv({
      paneId: 'pane-1',
      agent: 'codex',
      bindUrl: 'http://127.0.0.1:7700/api/internal/session-bind',
      paneToken: 'tok',
    })).toEqual({ cliArgs: [], env: {} })
  })

  it('returns plugin-dir args and env for claudecode', () => {
    const patch = injectPluginEnv({
      paneId: 'pane-42',
      agent: 'claudecode',
      bindUrl: 'http://127.0.0.1:7700/api/internal/session-bind',
      paneToken: 'tok-abc',
      pluginDir: '/abs/mexus-plugin',
    })
    expect(patch.cliArgs).toEqual(['--plugin-dir', '/abs/mexus-plugin'])
    expect(patch.env).toEqual({
      MEXUS_PANE_ID: 'pane-42',
      MEXUS_BIND_URL: 'http://127.0.0.1:7700/api/internal/session-bind',
      MEXUS_BIND_TOKEN: 'tok-abc',
    })
  })

  it('adds MEXUS_PLUGIN_DEBUG=1 only when debug is set', () => {
    const patch = injectPluginEnv({
      paneId: 'pane-1',
      agent: 'claudecode',
      bindUrl: 'http://x',
      paneToken: 'tok',
      pluginDir: '/p',
      debug: true,
    })
    expect(patch.env.MEXUS_PLUGIN_DEBUG).toBe('1')
  })

  it('resolvePluginDir resolves to packages/mexus-plugin', () => {
    const dir = resolvePluginDir()
    expect(path.basename(dir)).toBe('mexus-plugin')
    // Should sit beside packages/server (both under packages/)
    expect(path.basename(path.dirname(dir))).toBe('packages')
  })
})
