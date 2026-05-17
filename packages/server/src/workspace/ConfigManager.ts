import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import yaml from 'js-yaml'
import type { GlobalConfig, WorkspaceConfig, AgentDefinition, AgentAvailability, ModelProviderConfig } from '../types.ts'

const execFileAsync = promisify(execFile)

const GLOBAL_DIR = path.join(os.homedir(), '.nexus')

function getGlobalDir(): string {
  return process.env.NEXUS_GLOBAL_CONFIG_DIR || GLOBAL_DIR
}

function getGlobalConfigPath(): string {
  return path.join(getGlobalDir(), 'config.yaml')
}

const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  version: '1',
  defaults: {
    shell: process.env.SHELL || '/bin/bash',
    scrollback_lines: 5000,
    grid_columns: 2,
    history_retention_days: 30,
    theme: 'dark-ide',
  },
  agents: {
    claudecode: {
      bin: 'claude',
      continue_flag: '--continue',
      resume_flag: '--resume',
      yolo_flag: '--dangerously-skip-permissions',
      statusline: true,
      transport: 'pty',
      env: {},
    },
    codex: {
      bin: 'codex',
      default_args: ['--no-alt-screen'],
      continue_flag: '',
      resume_command: 'resume',
      resume_flag: '',
      yolo_flag: '',
      statusline: false,
      transport: 'pty',
      env: {},
    },
    opencode: {
      bin: 'opencode',
      continue_flag: '--continue',
      resume_flag: '',
      yolo_flag: '--yolo',
      statusline: false,
      transport: 'pty',
      env: {},
    },
    'kimi-cli': {
      bin: 'kimi',
      continue_flag: '--continue',
      resume_flag: '',
      yolo_flag: '',
      statusline: false,
      transport: 'pty',
      env: {},
    },
    qodercli: {
      bin: 'qodercli',
      continue_flag: '-c',
      resume_flag: '-r',
      yolo_flag: '--yolo',
      statusline: false,
      transport: 'pty',
      env: {},
    },
  },
  mission_defaults: {},
  models: {
    defaults: {
      tool_model: '',
    },
    providers: {},
  },
}

function cloneDefaultGlobalConfig(): GlobalConfig {
  return structuredClone(DEFAULT_GLOBAL_CONFIG)
}

function defaultProviderForType(type: ModelProviderConfig['type']): ModelProviderConfig {
  return {
    name: '',
    type,
    enabled: true,
    base_url: '',
    api_key: '',
    models: [],
    proxy: {
      enabled: false,
      mode: type,
      port: 0,
    },
  }
}

function mergeModelProvider(provider: Partial<ModelProviderConfig>, fallback: ModelProviderConfig): ModelProviderConfig {
  const type = provider.type === 'anthropic' || provider.type === 'openai' ? provider.type : ''
  const typeFallback = defaultProviderForType(type)
  return {
    name: provider.name ?? fallback.name,
    type,
    enabled: provider.enabled ?? fallback.enabled,
    base_url: provider.base_url ?? typeFallback.base_url,
    api_key: provider.api_key ?? '',
    models: Array.isArray(provider.models)
      ? provider.models.map((model) => ({
        id: model.id,
        name: model.name || model.id,
        enabled: model.enabled ?? true,
      })).filter((model) => model.id)
      : [],
    proxy: {
      enabled: provider.proxy?.enabled ?? false,
      mode: provider.proxy?.mode === 'anthropic' || provider.proxy?.mode === 'openai' ? provider.proxy.mode : type,
      port: provider.proxy?.port ?? typeFallback.proxy.port,
    },
  }
}

function mergeMissingGlobalConfig(config: GlobalConfig): boolean {
  let updated = false

  for (const [key, def] of Object.entries(DEFAULT_GLOBAL_CONFIG.agents)) {
    if (!config.agents[key]) {
      config.agents[key] = structuredClone(def)
      updated = true
    } else {
      const existing = config.agents[key]
      for (const [field, value] of Object.entries(def)) {
        if (!(field in existing)) {
          (existing as Record<string, unknown>)[field] = value
          updated = true
        }
      }
    }
  }

  if (!config.mission_defaults) {
    config.mission_defaults = {}
    updated = true
  } else if (
    config.mission_defaults.agent_type &&
    (config.mission_defaults.agent_type === '__shell__' || !config.agents[config.mission_defaults.agent_type])
  ) {
    delete config.mission_defaults.agent_type
    updated = true
  }

  if (!config.models) {
    config.models = structuredClone(DEFAULT_GLOBAL_CONFIG.models)
    return true
  }

  if (!config.models.defaults) {
    config.models.defaults = structuredClone(DEFAULT_GLOBAL_CONFIG.models.defaults)
    updated = true
  } else if (!config.models.defaults.tool_model) {
    config.models.defaults.tool_model = DEFAULT_GLOBAL_CONFIG.models.defaults.tool_model
    updated = true
  }

  if (!config.models.providers) {
    config.models.providers = {}
    updated = true
  }

  for (const [key, provider] of Object.entries(config.models.providers)) {
    const fallback = DEFAULT_GLOBAL_CONFIG.models.providers[key] || defaultProviderForType(provider.type)
    const merged = mergeModelProvider(provider, fallback)
    if (JSON.stringify(merged) !== JSON.stringify(provider)) {
      config.models.providers[key] = merged
      updated = true
    }
  }

  return updated
}

export class ConfigManager {
  private globalConfig: GlobalConfig | null = null
  private workspaceConfig: WorkspaceConfig | null = null
  private projectDir: string

  constructor(projectDir: string) {
    this.projectDir = projectDir
  }

  loadGlobalConfig(): GlobalConfig {
    if (this.globalConfig) return this.globalConfig

    const globalConfigPath = getGlobalConfigPath()
    if (fs.existsSync(globalConfigPath)) {
      const content = fs.readFileSync(globalConfigPath, 'utf-8')
      this.globalConfig = yaml.load(content) as GlobalConfig
      // Merge in any default agents or missing fields from the saved config
      const updated = mergeMissingGlobalConfig(this.globalConfig)
      if (updated) {
        this.saveGlobalConfig(this.globalConfig)
      }
    } else {
      this.globalConfig = cloneDefaultGlobalConfig()
      // Agent detection is async now — save defaults first, detect in background
      this.saveGlobalConfig(this.globalConfig)
      this.detectAgentsAsync().then((detected) => {
        if (Object.keys(detected).length > 0 && this.globalConfig) {
          this.globalConfig.agents = { ...this.globalConfig.agents, ...detected }
          this.saveGlobalConfig(this.globalConfig)
        }
      }).catch(() => { /* ignore detection failure */ })
    }

    return this.globalConfig
  }

  private saveGlobalConfig(config: GlobalConfig): void {
    fs.mkdirSync(getGlobalDir(), { recursive: true })
    fs.writeFileSync(getGlobalConfigPath(), yaml.dump(config, { lineWidth: -1 }))
  }

  loadWorkspaceConfig(): WorkspaceConfig | null {
    if (this.workspaceConfig) return this.workspaceConfig

    const configPath = path.join(this.projectDir, '.nexus', 'config.yaml')
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8')
      const parsed = yaml.load(content) as WorkspaceConfig | null
      if (parsed) {
        if (!Array.isArray(parsed.panes)) parsed.panes = []
        if (!('active_mission' in parsed)) parsed.active_mission = undefined
        this.workspaceConfig = parsed
        return this.workspaceConfig
      }
    }

    return null
  }

  saveWorkspaceConfig(config: WorkspaceConfig): void {
    const nexusDir = path.join(this.projectDir, '.nexus')
    fs.mkdirSync(nexusDir, { recursive: true })
    const configPath = path.join(nexusDir, 'config.yaml')
    fs.writeFileSync(configPath, yaml.dump(config, { lineWidth: -1 }))
    this.workspaceConfig = config
  }

  initWorkspace(): WorkspaceConfig {
    const existing = this.loadWorkspaceConfig()
    if (existing) return existing

    const dirName = path.basename(this.projectDir)
    const isGit = fs.existsSync(path.join(this.projectDir, '.git'))

    const config: WorkspaceConfig = {
      version: '1',
      name: dirName,
      description: '',
      repository: {
        path: '.',
        git: isGit,
      },
      panes: [],
    }

    this.saveWorkspaceConfig(config)
    return config
  }

  private async detectAgentsAsync(): Promise<Record<string, AgentDefinition>> {
    const agents: Record<string, AgentDefinition> = {}

    const agentBins: Array<{ key: string; bin: string; flag: string; defaultArgs?: string[]; resumeCommand?: string; statusline: boolean; transport: 'pty' | 'acp' }> = [
      { key: 'claudecode', bin: 'claude', flag: '--continue', statusline: true, transport: 'pty' },
      { key: 'codex', bin: 'codex', flag: '', defaultArgs: ['--no-alt-screen'], resumeCommand: 'resume', statusline: false, transport: 'pty' },
      { key: 'opencode', bin: 'opencode', flag: '--continue', statusline: false, transport: 'pty' },
      { key: 'kimi-cli', bin: 'kimi', flag: '--continue', statusline: false, transport: 'pty' },
      { key: 'qodercli', bin: 'qodercli', flag: '-c', statusline: false, transport: 'pty' },
    ]

    const results = await Promise.allSettled(
      agentBins.map(async (agent) => {
        await execFileAsync('which', [agent.bin], { timeout: 3000 })
        return agent
      })
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const agent = result.value
        agents[agent.key] = {
          bin: agent.bin,
          default_args: agent.defaultArgs,
          continue_flag: agent.flag,
          resume_command: 'resumeCommand' in agent ? agent.resumeCommand : undefined,
          statusline: agent.statusline,
          transport: agent.transport,
          env: {},
        }
      }
    }

    return agents
  }

  getAgentDefinition(agentType: string): AgentDefinition | undefined {
    const global = this.loadGlobalConfig()
    return global.agents[agentType]
  }

  getShell(): string {
    const global = this.loadGlobalConfig()
    const configured = global.defaults.shell
    // Prefer zsh > configured > $SHELL > /bin/sh
    // Include macOS Homebrew paths for Apple Silicon and Intel
    const candidates = [
      '/opt/homebrew/bin/zsh',  // macOS Apple Silicon Homebrew
      '/usr/local/bin/zsh',     // macOS Intel Homebrew
      '/usr/bin/zsh',           // Linux
      '/bin/zsh',               // macOS default / Linux
      configured,
      process.env.SHELL,
      '/bin/bash',
      '/bin/sh',
    ]
    for (const sh of candidates) {
      if (!sh) continue
      try {
        fs.accessSync(sh, fs.constants.X_OK)
        return sh
      } catch {
        // try next
      }
    }
    return '/bin/sh'
  }

  /**
   * Check which agents are available (installed) on the system.
   * Returns a record of agentType → { installed, bin, installHint }
   */
  async checkAgentAvailability(): Promise<Record<string, AgentAvailability>> {
    const global = this.loadGlobalConfig()
    const knownAgents: Array<{ key: string; bin: string; installHint: string }> = [
      { key: 'claudecode', bin: 'claude', installHint: 'npm install -g @anthropic-ai/claude-code' },
      { key: 'codex', bin: 'codex', installHint: 'npm install -g @openai/codex' },
      { key: 'opencode', bin: 'opencode', installHint: 'go install github.com/opencode-ai/opencode@latest' },
      { key: 'kimi-cli', bin: 'kimi', installHint: 'pip install kimi-cli' },
      { key: 'qodercli', bin: 'qodercli', installHint: 'See https://docs.qoder.com/zh/cli/using-cli' },
    ]

    const checks = await Promise.allSettled(
      knownAgents.map(async (agent) => {
        const def = global.agents[agent.key]
        const bin = def?.bin || agent.bin
        try {
          await execFileAsync('which', [bin], { timeout: 3000 })
          return { ...agent, bin, installed: true }
        } catch {
          return { ...agent, bin, installed: false }
        }
      })
    )

    const result: Record<string, AgentAvailability> = {}
    for (const check of checks) {
      if (check.status === 'fulfilled') {
        const { key, bin, installHint, installed } = check.value
        result[key] = { installed, bin, installHint }
      }
    }

    return result
  }

  updateGlobalConfig(config: GlobalConfig): void {
    mergeMissingGlobalConfig(config)
    this.globalConfig = config
    this.saveGlobalConfig(config)
  }

  getProjectDir(): string {
    return this.projectDir
  }
}
