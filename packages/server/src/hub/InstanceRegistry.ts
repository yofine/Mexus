import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'

export type InstanceStatus = 'running' | 'stopped'

export type InstanceRecord = {
  pid: number
  port: number
  cwd: string
  projectName: string
  startedAt: number
  status: InstanceStatus
}

function getRegistryDir(): string {
  return process.env.NEXUS_REGISTRY_DIR || path.join(os.homedir(), '.nexus')
}

function getRegistryPath(): string {
  return path.join(getRegistryDir(), 'instances.json')
}

function readRaw(): InstanceRecord[] {
  try {
    const raw = fs.readFileSync(getRegistryPath(), 'utf-8')
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function writeRaw(records: InstanceRecord[]) {
  fs.mkdirSync(getRegistryDir(), { recursive: true })
  fs.writeFileSync(getRegistryPath(), JSON.stringify(records, null, 2), 'utf-8')
}

function isAlive(pid: number): boolean {
  if (!pid || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function normalize(records: InstanceRecord[]): InstanceRecord[] {
  const byPort = new Map<number, InstanceRecord>()
  for (const record of records) {
    const current: InstanceRecord = {
      ...record,
      status: record.status === 'running' ? 'running' : 'stopped',
    }
    const existing = byPort.get(current.port)
    if (!existing || existing.startedAt <= current.startedAt) {
      byPort.set(current.port, current)
    }
  }
  return [...byPort.values()].sort((a, b) => a.port - b.port)
}

function refreshRuntimeState(records: InstanceRecord[]): { records: InstanceRecord[]; changed: boolean } {
  let changed = false
  const next = records.map((record) => {
    if (record.status === 'running' && record.pid > 0 && !isAlive(record.pid)) {
      changed = true
      return { ...record, pid: 0, status: 'stopped' as const }
    }
    return record
  })
  return { records: next, changed }
}

function updateRecords(mutator: (records: InstanceRecord[]) => InstanceRecord[]): InstanceRecord[] {
  const current = normalize(readRaw())
  const next = normalize(mutator(current))
  writeRaw(next)
  return next
}

export function listInstances(): InstanceRecord[] {
  const current = normalize(readRaw())
  const { records, changed } = refreshRuntimeState(current)
  if (changed) writeRaw(records)
  return records
}

export function getInstanceByPort(port: number): InstanceRecord | undefined {
  return listInstances().find((record) => record.port === port)
}

export function register(record: Omit<InstanceRecord, 'status'> & { status?: InstanceStatus }) {
  updateRecords((records) => {
    const next = records.filter((r) => r.port !== record.port)
    next.push({
      ...record,
      status: record.status || 'running',
    })
    return next
  })
}

export function markStoppedByPid(pid: number) {
  if (!pid || pid <= 0) return
  updateRecords((records) => records.map((record) => (
    record.pid === pid
      ? { ...record, pid: 0, status: 'stopped' as const }
      : record
  )))
}

export function markStoppedByPort(port: number) {
  updateRecords((records) => records.map((record) => (
    record.port === port
      ? { ...record, pid: 0, status: 'stopped' as const }
      : record
  )))
}

export function removeByPort(port: number) {
  updateRecords((records) => records.filter((record) => record.port !== port))
}

export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(port, '0.0.0.0')
  })
}

export async function findFreePort(start = 7700, max = 7800): Promise<number> {
  const taken = new Set(
    listInstances()
      .filter((record) => record.status === 'running')
      .map((record) => record.port),
  )
  for (let p = start; p <= max; p++) {
    if (taken.has(p)) continue
    if (await isPortFree(p)) return p
  }
  throw new Error(`No free port in range ${start}-${max}`)
}

type HealthInfo = {
  status?: string
  pid?: number
  port?: number
  projectDir?: string
  projectName?: string
}

async function probeHealth(port: number, timeoutMs = 400): Promise<HealthInfo | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`http://localhost:${port}/api/health`, { signal: ctrl.signal })
    if (!res.ok) return null
    const data = (await res.json().catch(() => null)) as HealthInfo | null
    return data?.status === 'ok' ? data : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function scanInstances(start = 7700, max = 7800): Promise<InstanceRecord[]> {
  const existing = listInstances()
  const byPort = new Map(existing.map((record) => [record.port, record] as const))

  const probes = await Promise.all(
    Array.from({ length: max - start + 1 }, (_, i) => start + i)
      .map(async (port) => ({ port, info: await probeHealth(port) })),
  )

  for (const { port, info } of probes) {
    if (!info) continue
    byPort.set(port, {
      pid: info.pid ?? 0,
      port,
      cwd: info.projectDir ?? '(unknown)',
      projectName: info.projectName ?? `port:${port}`,
      startedAt: byPort.get(port)?.startedAt ?? Date.now(),
      status: 'running',
    })
  }

  const knownPorts = new Set(
    probes.filter((probe) => probe.info !== null).map((probe) => probe.port),
  )

  for (const [port, record] of byPort) {
    if (record.status === 'running' && !knownPorts.has(port)) {
      byPort.set(port, { ...record, pid: 0, status: 'stopped' })
    }
  }

  const merged = normalize([...byPort.values()])
  writeRaw(merged)
  return merged
}
