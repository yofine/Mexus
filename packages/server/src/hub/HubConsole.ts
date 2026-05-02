import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import React from 'react'
import { render, type Instance as InkInstance } from 'ink'
import { listInstances } from './InstanceRegistry.ts'
import { HubConsoleView, type HubConsoleSnapshot } from './HubConsoleView.ts'

export type HubConsoleOptions = {
  port: number
  logDir: string
}

type HubConsoleHandle = {
  stop: () => void
}

function registryPath(): string {
  return path.join(process.env.NEXUS_REGISTRY_DIR || path.join(os.homedir(), '.nexus'), 'instances.json')
}

function readPackageVersion(): string {
  const candidates = [
    path.resolve(__dirname, '../../../package.json'),
    path.resolve(__dirname, '../../../../package.json'),
    path.resolve(process.cwd(), 'package.json'),
  ]
  for (const candidate of candidates) {
    try {
      const data = JSON.parse(fs.readFileSync(candidate, 'utf-8')) as { name?: string; version?: string }
      if ((data.name === 'mexus-cli' || candidate.endsWith('/package.json')) && data.version) return data.version
    } catch { /* try next */ }
  }
  return 'dev'
}

function buildSnapshot(options: HubConsoleOptions): HubConsoleSnapshot {
  const instances = listInstances()
  const mem = process.memoryUsage()
  return {
    version: readPackageVersion(),
    port: options.port,
    pid: process.pid,
    nodeVersion: process.version,
    uptimeSeconds: process.uptime(),
    instances,
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
    },
    loadAverage: os.loadavg(),
    registryPath: registryPath(),
    logDir: options.logDir,
    warnings: [
      ...(!process.env.PATH ? ['PATH is empty; agent detection may fail'] : []),
    ],
  }
}

function renderPlain(options: HubConsoleOptions): string {
  const instances = listInstances()
  const running = instances.filter((instance) => instance.status === 'running').length
  return [
    `Mexus Hub running at http://localhost:${options.port}`,
    `  PID: ${process.pid}`,
    `  Projects: ${running} running / ${instances.length} tracked`,
    `  Registry: ${registryPath()}`,
    `  Logs: ${options.logDir}`,
  ].join('\n')
}

export function startHubConsole(options: HubConsoleOptions): HubConsoleHandle {
  if (!process.stdout.isTTY || process.env.MEXUS_HUB_CONSOLE === 'plain') {
    console.log(renderPlain(options))
    return { stop: () => {} }
  }

  let ink: InkInstance | null = null
  let stopped = false

  const renderSnapshot = () => {
    if (stopped) return
    const element = React.createElement(HubConsoleView, { snapshot: buildSnapshot(options) })
    if (ink) ink.rerender(element)
    else ink = render(element, { stdout: process.stdout, stderr: process.stderr, stdin: process.stdin, exitOnCtrlC: false })
  }

  renderSnapshot()
  const timer = setInterval(renderSnapshot, 3000)

  return {
    stop: () => {
      stopped = true
      clearInterval(timer)
      ink?.unmount()
      ink = null
      console.log(renderPlain(options))
    },
  }
}
