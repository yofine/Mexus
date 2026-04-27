import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import yaml from 'js-yaml'
import { afterEach, describe, expect, it } from 'vitest'
import { ConfigManager } from './ConfigManager.ts'

function makeTempConfigDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-global-config-'))
}

function withGlobalConfigDir<T>(fn: (dir: string) => T): T {
  const prev = process.env.NEXUS_GLOBAL_CONFIG_DIR
  const dir = makeTempConfigDir()
  process.env.NEXUS_GLOBAL_CONFIG_DIR = dir
  try {
    return fn(dir)
  } finally {
    if (prev === undefined) delete process.env.NEXUS_GLOBAL_CONFIG_DIR
    else process.env.NEXUS_GLOBAL_CONFIG_DIR = prev
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

afterEach(() => {
  delete process.env.NEXUS_GLOBAL_CONFIG_DIR
})

describe('ConfigManager global model config', () => {
  it('creates an empty model configuration without preset providers', () => withGlobalConfigDir(() => {
    const manager = new ConfigManager(process.cwd())

    const config = manager.loadGlobalConfig()

    expect(config.models.defaults.tool_model).toBe('')
    expect(config.models.providers).toEqual({})
  }))

  it('defaults opencode to the pty transport while acp mode is disabled', () => withGlobalConfigDir(() => {
    const manager = new ConfigManager(process.cwd())

    const config = manager.loadGlobalConfig()

    expect(config.agents.opencode.transport).toBe('pty')
  }))

  it('merges missing model config into an existing global config without overwriting user values', () => withGlobalConfigDir((dir) => {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'config.yaml'), yaml.dump({
      version: '1',
      defaults: {
        shell: '/bin/zsh',
        scrollback_lines: 1000,
        grid_columns: 2,
        history_retention_days: 7,
        theme: 'github-dark',
      },
      agents: {
        codex: {
          bin: 'custom-codex',
          continue_flag: '',
          statusline: false,
          transport: 'pty',
          env: {},
        },
      },
      models: {
        defaults: {
          tool_model: 'custom-openai/custom-model',
        },
        providers: {
          draft:
            {
              name: '',
              type: '',
              enabled: true,
              base_url: '',
              api_key: '',
              models: [],
            },
          'custom-openai': {
            name: 'Custom OpenAI',
            type: 'openai',
            enabled: false,
            base_url: 'http://localhost:8888/v1',
            api_key: 'local-key',
            models: [
              { id: 'custom-model' },
            ],
          },
        },
      },
    }, { lineWidth: -1 }))

    const manager = new ConfigManager(process.cwd())

    const config = manager.loadGlobalConfig()

    expect(config.models.defaults.tool_model).toBe('custom-openai/custom-model')
    expect(config.models.providers['custom-openai']).toEqual(expect.objectContaining({
      name: 'Custom OpenAI',
      enabled: false,
      base_url: 'http://localhost:8888/v1',
      api_key: 'local-key',
    }))
    expect(config.models.providers['custom-openai'].models[0]).toEqual({
      id: 'custom-model',
      name: 'custom-model',
      enabled: true,
    })
    expect(config.models.providers['custom-openai'].proxy).toEqual({
      enabled: false,
      mode: 'openai',
      port: 0,
    })
    expect(config.models.providers.draft).toEqual({
      name: '',
      type: '',
      enabled: true,
      base_url: '',
      api_key: '',
      models: [],
      proxy: {
        enabled: false,
        mode: '',
        port: 0,
      },
    })
    expect(config.models.providers['openai-main']).toBeUndefined()
    expect(config.models.providers['anthropic-main']).toBeUndefined()
  }))
})
