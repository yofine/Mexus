import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { startServer } from './index.ts'
import { CliError, resolveServerUrl, type CliHttpClient, type CliIo } from './cli/http.ts'
import { runPaneCommand } from './cli/pane.ts'
import { runMissionCommand } from './cli/mission.ts'
export function getCliCommandName(invokedPath?: string): 'mexus' | 'nexus' {
  const binaryName = invokedPath ? path.basename(invokedPath).toLowerCase() : ''
  return binaryName === 'nexus' ? 'nexus' : 'mexus'
}

export function shouldRunMain(invokedPath: string | undefined, moduleUrl: string): boolean {
  if (!invokedPath) return false

  try {
    const realInvokedPath = fs.realpathSync(invokedPath)
    return pathToFileURL(realInvokedPath).href === moduleUrl
  } catch {
    return pathToFileURL(path.resolve(invokedPath)).href === moduleUrl
  }
}

const COMMANDS = ['start', 'init', 'status', 'stop', 'hub', 'pane', 'mission', 'help'] as const

export function getSupportedCommands(): string[] {
  return [...COMMANDS]
}

// Check Node.js version — node-pty requires Node 22+
const nodeVersion = parseInt(process.versions.node.split('.')[0], 10)
if (nodeVersion < 22) {
  console.error(`Error: Mexus requires Node.js >= 22, but you are running v${process.versions.node}`)
  console.error(`  Please upgrade: nvm install 22 && nvm use 22`)
  process.exit(1)
}

// Clean up parent session env so spawned PTYs don't detect nesting
delete process.env.CLAUDECODE
delete process.env.CLAUDE_CODE
delete process.env.CLAUDE_CODE_ENTRYPOINT

const DEFAULT_PORT = 7700
const DEFAULT_HUB_PORT = 7600

function printUsage(commandName: string) {
  console.log(`
  Usage: ${commandName} [command] [directory]

  Commands:
    start [dir]    Start the Mexus server (default)
    init  [dir]    Initialize .nexus/ config in a project
    status [dir]   Show workspace status
    stop           Stop the running server
    hub            Start Mexus Hub to manage all instances
    pane           Manage Panes over REST
    mission        Manage Agent Team Missions over REST

  Arguments:
    dir            Path to the project directory (defaults to cwd)

  Environment:
    NEXUS_PORT     Server port (default: ${DEFAULT_PORT})
    NEXUS_HUB_PORT Hub dashboard port (default: ${DEFAULT_HUB_PORT})

  Examples:
    ${commandName}                        # Start in current directory
    ${commandName} ~/projects/my-app      # Start with a specific project
    ${commandName} start ~/projects/app   # Explicit start command
    ${commandName} init .                 # Initialize config in cwd
`.trimEnd())
}

function findProjectRoot(startDir: string): string {
  const home = process.env.HOME || process.env.USERPROFILE || ''

  // Walk up from startDir, prefer the highest-level match
  // (monorepo root, not a nested package)
  // Stop at HOME — never go above it
  let dir = startDir
  let bestMatch = startDir

  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir // pnpm monorepo root is definitive
    }
    if (
      fs.existsSync(path.join(dir, '.git')) ||
      fs.existsSync(path.join(dir, '.nexus'))
    ) {
      bestMatch = dir
    }
    const parent = path.dirname(dir)
    // Don't traverse above HOME directory
    if (home && parent === home && dir !== startDir) break
    dir = parent
  }

  // Warn if resolved to HOME — likely a mistake
  if (home && bestMatch === home && startDir === home) {
    console.warn(`Warning: Running Mexus in HOME directory (${home}).`)
    console.warn(`  Consider: mexus <project-path>`)
  }

  return bestMatch
}

function resolveProjectDir(dirArg?: string): string {
  if (process.env.NEXUS_PROJECT_DIR) {
    return path.resolve(process.env.NEXUS_PROJECT_DIR)
  }
  if (dirArg) {
    const resolved = path.resolve(dirArg)
    if (!fs.existsSync(resolved)) {
      console.error(`Error: directory does not exist: ${resolved}`)
      process.exit(1)
    }
    if (!fs.statSync(resolved).isDirectory()) {
      console.error(`Error: not a directory: ${resolved}`)
      process.exit(1)
    }
    return resolved
  }
  return findProjectRoot(process.cwd())
}

const COMMAND_SET = new Set(getSupportedCommands())

export interface RunCliOptions {
  argv: string[]
  invokedPath?: string
  env?: NodeJS.ProcessEnv
  httpClient?: CliHttpClient
  io?: CliIo
}

export async function runCli(options: RunCliOptions): Promise<void> {
  const args = [...options.argv]
  const env = options.env || process.env
  const io = options.io || {
    stdout: (text: string) => console.log(text),
    stderr: (text: string) => console.error(text),
  }
  const httpClient = options.httpClient || { fetch }
  const commandName = getCliCommandName(options.invokedPath)

  // Parse command and directory argument
  // Support: mexus <dir>, mexus <cmd> <dir>, mexus <cmd>
  let command: string
  let dirArg: string | undefined

  if (args.length === 0) {
    command = 'start'
  } else if (args[0] === '--help' || args[0] === '-h') {
    command = 'help'
  } else if (COMMAND_SET.has(args[0])) {
    command = args[0]
    dirArg = args[1]
  } else {
    // First arg is not a known command — treat it as a directory
    command = 'start'
    dirArg = args[0]
  }

  if (command === 'help') {
    printUsage(commandName)
    return
  }

  if (command === 'pane') {
    await runPaneCommand(args.slice(1), resolveServerUrl(env), httpClient, io)
    return
  }

  if (command === 'mission') {
    await runMissionCommand(args.slice(1), resolveServerUrl(env), httpClient, io)
    return
  }

  if (command === 'hub') {
    const hubPort = parseInt(env.NEXUS_HUB_PORT || String(DEFAULT_HUB_PORT), 10)
    const { startHub } = await import('./hub/index.ts')
    await startHub(hubPort, process.argv[1] || '')
    const url = `http://localhost:${hubPort}`
    import('open').then((mod) => mod.default(url)).catch(() => {})
    return
  }

  const projectDir = resolveProjectDir(dirArg)

  switch (command) {
    case 'start': {
      const port = parseInt(env.NEXUS_PORT || String(DEFAULT_PORT), 10)
      await startServer(port, projectDir)
      break
    }

    case 'init': {
      const { ConfigManager } = await import('./workspace/ConfigManager.ts')
      const configManager = new ConfigManager(projectDir)
      configManager.loadGlobalConfig()
      configManager.initWorkspace()
      console.log(`Initialized .nexus/ in ${projectDir}`)
      break
    }

    case 'status': {
      const { ConfigManager } = await import('./workspace/ConfigManager.ts')
      const configManager = new ConfigManager(projectDir)
      const wsConfig = configManager.loadWorkspaceConfig()
      if (!wsConfig) {
        console.log('No .nexus/config.yaml found. Run `mexus init` first.')
        break
      }
      console.log(`Workspace: ${wsConfig.name}`)
      console.log(`Panes: ${wsConfig.panes.length}`)
      for (const pane of wsConfig.panes) {
        console.log(`  - ${pane.id} [${pane.agent}] ${pane.name}${pane.task ? ` — ${pane.task}` : ''}`)
      }
      break
    }

    case 'stop': {
      try {
        const port = parseInt(env.NEXUS_PORT || String(DEFAULT_PORT), 10)
        const res = await httpClient.fetch(`http://localhost:${port}/api/health`)
        if (res.ok) {
          console.log('Sending shutdown signal...')
          process.kill(process.pid, 'SIGTERM')
        }
      } catch {
        console.log('No running Mexus server found.')
      }
      break
    }

    default:
      console.error(`Unknown command: ${command}`)
      printUsage(commandName)
      process.exit(1)
  }
}

async function main() {
  try {
    await runCli({
      argv: process.argv.slice(2),
      invokedPath: process.argv[1],
      env: process.env,
      httpClient: { fetch },
    })
  } catch (err) {
    if (err instanceof CliError) {
      console.error(err.message)
      process.exit(err.exitCode)
    }
    throw err
  }
}

const isEntrypoint = shouldRunMain(process.argv[1], import.meta.url)

if (isEntrypoint) {
  main().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
}
