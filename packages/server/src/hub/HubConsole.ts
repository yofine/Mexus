import os from 'node:os'
import path from 'node:path'
import { listInstances } from './InstanceRegistry.ts'

type HubConsoleOptions = {
  port: number
  logDir: string
}

type HubConsoleHandle = {
  stop: () => void
}

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const GRAY = '\x1b[90m'

function color(value: string, code: string): string {
  if (process.env.NO_COLOR) return value
  return `${code}${value}${RESET}`
}

function visibleLength(value: string): number {
  return value.replace(/\x1b\[[0-9;]*m/g, '').length
}

function padAnsi(value: string, width: number): string {
  return value + ' '.repeat(Math.max(0, width - visibleLength(value)))
}

function fitAnsi(value: string, width: number): string {
  const plain = value.replace(/\x1b\[[0-9;]*m/g, '')
  if (plain.length <= width) return padAnsi(value, width)
  return truncate(plain, width).padEnd(width)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = units[0]
  for (let i = 1; i < units.length && value >= 1024; i++) {
    value /= 1024
    unit = units[i]
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${unit}`
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hrs = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hrs > 0) return `${hrs}h ${mins}m`
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  if (max <= 3) return value.slice(0, max)
  return `${value.slice(0, max - 3)}...`
}

function registryPath(): string {
  return path.join(process.env.NEXUS_REGISTRY_DIR || path.join(os.homedir(), '.nexus'), 'instances.json')
}

function renderLogo(): string[] {
  return [
    '  __  __',
    ' |  \\/  | ___  __  __ _   _ ___',
    ' | |\\/| |/ _ \\ \\ \\/ /| | | / __|',
    ' | |  | |  __/  >  < | |_| \\__ \\',
    ' |_|  |_|\\___| /_/\\_\\ \\__,_|___/',
  ]
}

function renderInstances(): string[] {
  const instances = listInstances()
  if (instances.length === 0) {
    return [color('  no tracked servers yet', GRAY)]
  }

  return instances.slice(0, 8).map((instance) => {
    const statusText = instance.status === 'running' ? 'running' : 'stopped'
    const status = instance.status === 'running'
      ? color(statusText.padEnd(8), GREEN)
      : color(statusText.padEnd(8), GRAY)
    const pid = instance.pid > 0 ? String(instance.pid) : '-'
    const marker = instance.status === 'running' ? color('*', GREEN) : color('o', GRAY)
    return `  ${marker} ${String(instance.port).padEnd(5)} ${status} ${truncate(instance.projectName, 18).padEnd(18)} pid ${pid}`
  })
}

function renderBox(title: string, content: string[], width: number): string[] {
  const innerWidth = width - 4
  const titleText = ` ${title} `
  const top = `╭${titleText}${'─'.repeat(Math.max(0, width - visibleLength(titleText) - 2))}╮`
  const body = content.length > 0
    ? content.map((line) => `│ ${fitAnsi(line, innerWidth)} │`)
    : [`│ ${' '.repeat(innerWidth)} │`]
  const bottom = `╰${'─'.repeat(width - 2)}╯`
  return [color(top, GRAY), ...body, color(bottom, GRAY)]
}

function renderWarnings(): string[] {
  const warnings: string[] = []
  try {
    listInstances()
  } catch (err) {
    warnings.push(`registry read failed: ${(err as Error).message}`)
  }
  if (!process.env.PATH) warnings.push('PATH is empty; agent detection may fail')
  return warnings
}

function renderDashboard(options: HubConsoleOptions): string {
  const instances = listInstances()
  const running = instances.filter((instance) => instance.status === 'running').length
  const stopped = instances.length - running
  const mem = process.memoryUsage()
  const load = os.loadavg()
  const warnings = renderWarnings()

  const terminalWidth = process.stdout.columns || 112
  const leftWidth = Math.max(36, Math.min(44, Math.floor(terminalWidth * 0.38)))
  const gap = 3
  const rightWidth = Math.max(48, terminalWidth - leftWidth - gap)

  const left = renderBox('Mexus', [
    ...renderLogo().map((line) => color(line, CYAN)),
    '',
    `  ${color('hub', BOLD)}       local workspace console`,
    `  ${color('url', BOLD)}       ${color(`http://localhost:${options.port}`, GREEN)}`,
    '',
    `  ${color('Dashboard', GREEN)}`,
    `  ${color('Projects', GRAY)}`,
    `  ${color('Connections', GRAY)}`,
    `  ${color('Settings', GRAY)}`,
    '',
    color('  ctrl+c to stop', GRAY),
  ], leftWidth)

  const right = [
    ...renderBox('Status', [
    `  uptime      ${formatDuration(process.uptime())}`,
    `  pid         ${process.pid}`,
    `  node        ${process.version}`,
    ], rightWidth),
    '',
    ...renderBox('Projects', [
    `  running     ${color(String(running), running > 0 ? GREEN : GRAY)}`,
    `  stopped     ${stopped}`,
    `  tracked     ${instances.length}`,
    ], rightWidth),
    '',
    ...renderBox('Connections', renderInstances(), rightWidth),
    '',
    ...renderBox('Resources', [
    `  memory      rss ${formatBytes(mem.rss)} / heap ${formatBytes(mem.heapUsed)}`,
    `  load        ${load.map((value) => value.toFixed(2)).join('  ')}`,
    ], rightWidth),
    '',
    ...renderBox('Paths', [
    `  registry    ${registryPath()}`,
    `  logs        ${options.logDir}`,
    ], rightWidth),
  ]

  if (warnings.length > 0) {
    right.push('', ...renderBox(color('Warnings', YELLOW), warnings.map((warning) => `  ${color(warning, RED)}`), rightWidth))
  }

  const rows = Math.max(left.length, right.length)
  const lines: string[] = []
  for (let i = 0; i < rows; i++) {
    const l = left[i] || ''
    const r = right[i] || ''
    lines.push(`${padAnsi(l, leftWidth)}${' '.repeat(gap)}${r}`)
  }
  return `${lines.join('\n')}\n`
}

function renderPlain(options: HubConsoleOptions): string {
  const instances = listInstances()
  const running = instances.filter((instance) => instance.status === 'running').length
  return [
    `Mexus Hub running at http://localhost:${options.port}`,
    `  PID: ${process.pid}`,
    `  Servers: ${running} running / ${instances.length} tracked`,
    `  Registry: ${registryPath()}`,
    `  Logs: ${options.logDir}`,
  ].join('\n')
}

export function startHubConsole(options: HubConsoleOptions): HubConsoleHandle {
  if (!process.stdout.isTTY || process.env.MEXUS_HUB_CONSOLE === 'plain') {
    console.log(renderPlain(options))
    return { stop: () => {} }
  }

  let stopped = false
  const render = () => {
    if (stopped) return
    process.stdout.write('\x1b[?25l')
    process.stdout.write('\x1b[2J\x1b[H')
    process.stdout.write(renderDashboard(options))
  }

  render()
  const timer = setInterval(render, 3000)
  return {
    stop: () => {
      stopped = true
      clearInterval(timer)
      process.stdout.write('\x1b[?25h')
      process.stdout.write('\n')
    },
  }
}
