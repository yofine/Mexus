import React from 'react'
import { Box, Text } from 'ink'
import type { InstanceRecord } from './InstanceRegistry.ts'

export type HubConsoleSnapshot = {
  version: string
  port: number
  pid: number
  nodeVersion: string
  uptimeSeconds: number
  instances: InstanceRecord[]
  memory: {
    rss: number
    heapUsed: number
  }
  loadAverage: number[]
  registryPath: string
  logDir: string
  warnings: string[]
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

function Row({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return React.createElement(Box, null,
    React.createElement(Box, { width: 13 }, React.createElement(Text, { color: 'gray' }, label)),
    React.createElement(Text, { color }, String(value)),
  )
}

function Card({ title, children, width }: { title: string; children?: React.ReactNode; width?: number }) {
  return React.createElement(Box, {
    borderStyle: 'round',
    borderColor: 'gray',
    flexDirection: 'column',
    paddingX: 1,
    paddingY: 0,
    width,
  },
    React.createElement(Text, { bold: true }, title),
    React.createElement(Box, { flexDirection: 'column', marginTop: 1 }, children),
  )
}

function Logo() {
  return React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Text, { color: 'cyan', bold: true }, '███╗   ███╗███████╗██╗  ██╗██╗   ██╗███████╗'),
    React.createElement(Text, { color: 'cyan', bold: true }, '████╗ ████║██╔════╝╚██╗██╔╝██║   ██║██╔════╝'),
    React.createElement(Text, { color: 'cyan', bold: true }, '██╔████╔██║█████╗   ╚███╔╝ ██║   ██║███████╗'),
    React.createElement(Text, { color: 'cyan', bold: true }, '██║╚██╔╝██║██╔══╝   ██╔██╗ ██║   ██║╚════██║'),
    React.createElement(Text, { color: 'cyan', bold: true }, '██║ ╚═╝ ██║███████╗██╔╝ ██╗╚██████╔╝███████║'),
    React.createElement(Text, { color: 'cyan', bold: true }, '╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝'),
  )
}

function BrandCard({ snapshot }: { snapshot: HubConsoleSnapshot }) {
  return React.createElement(Card, { title: 'Mexus', width: 64 },
    React.createElement(Logo),
    React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
      React.createElement(Row, { label: 'version', value: snapshot.version, color: 'cyan' }),
      React.createElement(Row, { label: 'hub', value: 'local workspace console' }),
      React.createElement(Row, { label: 'url', value: `http://localhost:${snapshot.port}`, color: 'green' }),
    ),
    React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
      React.createElement(Row, { label: 'registry', value: truncate(snapshot.registryPath, 44) }),
      React.createElement(Row, { label: 'logs', value: truncate(snapshot.logDir, 44) }),
    ),
    React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
      React.createElement(Text, { color: 'green' }, 'Dashboard'),
      React.createElement(Text, { color: 'gray' }, 'Projects'),
      React.createElement(Text, { color: 'gray' }, 'Connections'),
      React.createElement(Text, { color: 'gray' }, 'Settings'),
    ),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { color: 'gray' }, 'ctrl+c to stop'),
    ),
  )
}

function ProjectsCard({ snapshot }: { snapshot: HubConsoleSnapshot }) {
  const running = snapshot.instances.filter((instance) => instance.status === 'running').length
  const stopped = snapshot.instances.length - running
  return React.createElement(Card, { title: 'Projects', width: 36 },
    React.createElement(Row, { label: 'running', value: running, color: running > 0 ? 'green' : 'gray' }),
    React.createElement(Row, { label: 'stopped', value: stopped }),
    React.createElement(Row, { label: 'tracked', value: snapshot.instances.length }),
  )
}

function StatusCard({ snapshot }: { snapshot: HubConsoleSnapshot }) {
  return React.createElement(Card, { title: 'Status', width: 36 },
    React.createElement(Row, { label: 'uptime', value: formatDuration(snapshot.uptimeSeconds) }),
    React.createElement(Row, { label: 'pid', value: snapshot.pid }),
    React.createElement(Row, { label: 'node', value: snapshot.nodeVersion }),
  )
}

function ConnectionsCard({ snapshot }: { snapshot: HubConsoleSnapshot }) {
  const rows = snapshot.instances.slice(0, 8)
  return React.createElement(Card, { title: 'Connections', width: 76 },
    rows.length === 0
      ? React.createElement(Text, { color: 'gray' }, 'no tracked project connections yet')
      : rows.map((instance) => React.createElement(Box, { key: `${instance.port}:${instance.pid}` },
          React.createElement(Box, { width: 3 }, React.createElement(Text, { color: instance.status === 'running' ? 'green' : 'gray' }, instance.status === 'running' ? '●' : '○')),
          React.createElement(Box, { width: 7 }, React.createElement(Text, null, String(instance.port))),
          React.createElement(Box, { width: 11 }, React.createElement(Text, { color: instance.status === 'running' ? 'green' : 'gray' }, instance.status)),
          React.createElement(Box, { width: 24 }, React.createElement(Text, null, truncate(instance.projectName, 22))),
          React.createElement(Text, { color: 'gray' }, `pid ${instance.pid > 0 ? instance.pid : '-'}`),
        )),
  )
}

function ResourcesCard({ snapshot }: { snapshot: HubConsoleSnapshot }) {
  return React.createElement(Card, { title: 'Resources', width: 76 },
    React.createElement(Row, { label: 'memory', value: `rss ${formatBytes(snapshot.memory.rss)} / heap ${formatBytes(snapshot.memory.heapUsed)}` }),
    React.createElement(Row, { label: 'load', value: snapshot.loadAverage.map((value) => value.toFixed(2)).join('  ') }),
  )
}

function WarningsCard({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null
  return React.createElement(Card, { title: 'Warnings', width: 76 },
    warnings.map((warning) => React.createElement(Text, { key: warning, color: 'yellow' }, warning)),
  )
}

export function HubConsoleView({ snapshot }: { snapshot: HubConsoleSnapshot }) {
  return React.createElement(Box, { flexDirection: 'column', paddingX: 1, paddingY: 1 },
    React.createElement(Box, { gap: 2, alignItems: 'flex-start' },
      React.createElement(BrandCard, { snapshot }),
      React.createElement(Box, { flexDirection: 'column', gap: 1 },
        React.createElement(Box, { gap: 2 },
          React.createElement(StatusCard, { snapshot }),
          React.createElement(ProjectsCard, { snapshot }),
        ),
        React.createElement(ConnectionsCard, { snapshot }),
        React.createElement(ResourcesCard, { snapshot }),
        React.createElement(WarningsCard, { warnings: snapshot.warnings }),
      ),
    ),
  )
}
