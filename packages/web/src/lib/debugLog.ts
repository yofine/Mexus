type DebugData = Record<string, unknown>

type DebugEntry = {
  ts: string
  area: string
  event: string
  data?: DebugData
}

declare global {
  interface Window {
    mexusDebugLogs?: DebugEntry[]
    mexusDebugDump?: () => string
    mexusDebugCopy?: () => Promise<string>
    mexusDebugClear?: () => void
  }
}

const MAX_ENTRIES = 1000

function getBuffer(): DebugEntry[] {
  if (!window.mexusDebugLogs) window.mexusDebugLogs = []
  return window.mexusDebugLogs
}

function sanitize(value: unknown): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack }
  if (Array.isArray(value)) return value.map(sanitize)
  if (!value || typeof value !== 'object') return value
  const result: DebugData = {}
  for (const [key, item] of Object.entries(value)) {
    if (key === 'data' && typeof item === 'string' && item.length > 120) {
      result[key] = `${item.slice(0, 120)}...(${item.length} chars)`
    } else {
      result[key] = sanitize(item)
    }
  }
  return result
}

function formatEntries(entries: DebugEntry[]): string {
  return entries.map((entry) => JSON.stringify(entry)).join('\n')
}

function installHelpers(): void {
  if (window.mexusDebugDump) return
  window.mexusDebugDump = () => formatEntries(getBuffer())
  window.mexusDebugCopy = async () => {
    const text = window.mexusDebugDump ? window.mexusDebugDump() : ''
    try {
      await navigator.clipboard.writeText(text)
      console.info(`[MexusDebug] copied ${getBuffer().length} entries`)
    } catch {
      console.info('[MexusDebug] clipboard unavailable; returning debug text')
    }
    return text
  }
  window.mexusDebugClear = () => {
    window.mexusDebugLogs = []
    console.info('[MexusDebug] cleared')
  }
}

export function debugLog(area: string, event: string, data?: DebugData): void {
  if (typeof window === 'undefined') return
  installHelpers()
  const entry: DebugEntry = {
    ts: new Date().toISOString(),
    area,
    event,
    data: data ? sanitize(data) as DebugData : undefined,
  }
  const buffer = getBuffer()
  buffer.push(entry)
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES)
  console.debug('[MexusDebug]', area, event, entry.data || '')
}

export function summarizeShells(shells: Array<{ id: string; name: string; agent?: string }>): string[] {
  return shells.map((pane) => `${pane.id}:${pane.name}`)
}
