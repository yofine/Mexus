import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import fastifyProxy from '@fastify/http-proxy'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  findFreePort,
  getInstanceByPort,
  isPortFree,
  listInstances,
  markStoppedByPort,
  register,
  removeByPort,
  scanInstances,
} from './InstanceRegistry.ts'
import { ConfigManager } from '../workspace/ConfigManager.ts'
import { testModelProviderConnection } from '../models/ModelConnectionTester.ts'
import type { GlobalConfig, ModelDefinition, ModelProviderConfig } from '../types.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HUB_LOG_DIR = path.join(os.homedir(), '.nexus', 'hub-logs')

type HealthInfo = {
  status?: string
  pid?: number
  port?: number
  projectDir?: string
  projectName?: string
}

type ExpectedInstance = {
  pid?: number
  cwd: string
}

function addCorsHeaders(reply: { header: (name: string, value: string) => void }) {
  reply.header('Access-Control-Allow-Origin', '*')
  reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function resolveWebDistPath(): string {
  return path.resolve(__dirname, '../../web/dist')
}

function localInstanceUpstream(port: string | number): string {
  const parsed = typeof port === 'number' ? port : parseInt(port, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 'http://127.0.0.1:0'
  return `http://127.0.0.1:${parsed}`
}

function spawnLocalInstance(cliEntry: string, cwd: string, assignedPort: number) {
  fs.mkdirSync(HUB_LOG_DIR, { recursive: true })
  const logPath = path.join(HUB_LOG_DIR, `instance-${assignedPort}.log`)
  const out = fs.openSync(logPath, 'a')
  const err = fs.openSync(logPath, 'a')
  const env: NodeJS.ProcessEnv = { ...process.env, NEXUS_PORT: String(assignedPort) }
  delete env.NEXUS_PROJECT_DIR

  const isTs = cliEntry.endsWith('.ts') || cliEntry.endsWith('.tsx')
  const cmd = isTs ? 'npx' : process.execPath
  const args = isTs ? ['tsx', cliEntry, 'start', cwd] : [cliEntry, 'start', cwd]

  const child = spawn(cmd, args, {
    detached: true,
    stdio: ['ignore', out, err],
    env,
  })
  child.unref()
  return { child, logPath }
}

function normalizePathForCompare(value: string): string {
  return path.resolve(value)
}

function matchesExpectedInstance(info: HealthInfo, expected?: ExpectedInstance): boolean {
  if (info.status !== 'ok') return false
  if (!expected) return true
  if (expected.pid && info.pid !== expected.pid) return false
  if (info.projectDir && normalizePathForCompare(info.projectDir) !== normalizePathForCompare(expected.cwd)) return false
  return true
}

async function waitForLocalInstance(port: number, expected?: ExpectedInstance, timeoutMs = 10_000): Promise<HealthInfo | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/api/health`)
      if (res.ok) {
        const data = await res.json().catch(() => null) as HealthInfo | null
        if (data && matchesExpectedInstance(data, expected)) return data
      }
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  return null
}

async function stopLocalInstance(port: number): Promise<boolean> {
  const record = getInstanceByPort(port)
  let stopped = false
  try {
    const res = await fetch(`http://localhost:${port}/api/shutdown`, { method: 'POST' })
    if (res.ok) stopped = true
  } catch { /* ignore */ }
  if (!stopped && record?.pid && record.pid > 0) {
    try {
      process.kill(record.pid, 'SIGTERM')
      stopped = true
    } catch { /* ignore */ }
  }
  markStoppedByPort(port)
  return stopped
}

export async function buildHubServer(cliEntry: string) {
  const fastify = Fastify({ logger: false })
  const configManager = new ConfigManager(process.cwd())

  fastify.addHook('onRequest', async (request, reply) => {
    addCorsHeaders(reply)
    if (request.method === 'OPTIONS') {
      reply.code(204).send()
    }
  })

  fastify.get('/api/hub/status', async () => {
    return { mode: 'hub', localOnly: true }
  })

  fastify.get('/api/hub/config', async () => {
    return configManager.loadGlobalConfig()
  })

  fastify.put('/api/hub/config', async (request, reply) => {
    try {
      const config = request.body as GlobalConfig
      configManager.updateGlobalConfig(config)
      return { success: true }
    } catch (err) {
      reply.code(400)
      return { error: (err as Error).message }
    }
  })

  fastify.get('/api/hub/agents', async () => {
    return configManager.checkAgentAvailability()
  })

  fastify.post('/api/hub/models/test-connection', async (request, reply) => {
    try {
      const body = request.body as { provider?: ModelProviderConfig; model?: ModelDefinition } | ModelProviderConfig
      return await testModelProviderConnection('provider' in body ? body.provider as ModelProviderConfig : body, 'model' in body ? body.model : undefined)
    } catch (err) {
      reply.code(400)
      return { ok: false, message: (err as Error).message }
    }
  })

  fastify.get('/api/config', async () => {
    return configManager.loadGlobalConfig()
  })

  fastify.put('/api/config', async (request, reply) => {
    try {
      const config = request.body as GlobalConfig
      configManager.updateGlobalConfig(config)
      return { success: true }
    } catch (err) {
      reply.code(400)
      return { error: (err as Error).message }
    }
  })

  fastify.get('/api/agents', async () => {
    return configManager.checkAgentAvailability()
  })

  await fastify.register(fastifyProxy, {
    // Keep this empty so both HTTP and WebSocket proxy paths use getUpstream().
    // A non-empty fallback upstream makes @fastify/http-proxy route every WS to
    // that static target before consulting getUpstream.
    upstream: '',
    prefix: '/api/instances/:port/proxy',
    rewritePrefix: '/',
    websocket: true,
    replyOptions: {
      getUpstream(request) {
        const { port } = request.params as { port: string }
        return localInstanceUpstream(port)
      },
    },
  })

  fastify.post('/api/models/test-connection', async (request, reply) => {
    try {
      const body = request.body as { provider?: ModelProviderConfig; model?: ModelDefinition } | ModelProviderConfig
      return await testModelProviderConnection('provider' in body ? body.provider as ModelProviderConfig : body, 'model' in body ? body.model : undefined)
    } catch (err) {
      reply.code(400)
      return { ok: false, message: (err as Error).message }
    }
  })

  fastify.get('/api/instances', async (request) => {
    const { scan } = request.query as { scan?: string }
    const instances = scan === '1' ? await scanInstances() : listInstances()
    return { instances }
  })

  fastify.post('/api/instances', async (request, reply) => {
    const body = request.body as { cwd?: string; port?: number }
    if (!body?.cwd) {
      reply.code(400)
      return { error: 'cwd is required' }
    }
    const cwd = path.resolve(body.cwd.replace(/^~(?=\/|$)/, process.env.HOME || ''))
    if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
      reply.code(400)
      return { error: `Not a directory: ${cwd}` }
    }

    await scanInstances()

    let assignedPort: number
    try {
      if (body.port) {
        const existing = getInstanceByPort(body.port)
        if (existing?.status === 'running') {
          reply.code(409)
          return { error: `Port ${body.port} is already used by running server: ${existing.projectName}`, instance: existing }
        }
        if (!(await isPortFree(body.port))) {
          reply.code(409)
          return { error: `Port ${body.port} is already in use` }
        }
      }
      assignedPort = body.port || (await findFreePort(7700, 7800))
    } catch (err) {
      reply.code(503)
      return { error: (err as Error).message }
    }

    const { child, logPath } = spawnLocalInstance(cliEntry, cwd, assignedPort)
    const projectName = path.basename(cwd)

    const ready = await waitForLocalInstance(assignedPort, { pid: child.pid, cwd })
    if (!ready) {
      reply.code(500)
      return {
        error: `Server on port ${assignedPort} did not become ready as the requested instance. Check log: ${logPath}`,
        pid: child.pid,
        port: assignedPort,
        cwd,
        projectName,
        logPath,
      }
    }

    register({
      pid: ready.pid || child.pid || 0,
      port: assignedPort,
      cwd: ready.projectDir || cwd,
      projectName: ready.projectName || projectName,
      startedAt: Date.now(),
      status: 'running',
    })

    return { pid: child.pid, port: assignedPort, cwd, projectName, logPath }
  })

  fastify.post('/api/instances/:port/start', async (request, reply) => {
    const { port: portStr } = request.params as { port: string }
    const port = parseInt(portStr, 10)
    if (!Number.isFinite(port)) {
      reply.code(400)
      return { error: 'Invalid port' }
    }

    const record = getInstanceByPort(port)
    if (!record) {
      reply.code(404)
      return { error: 'Instance not found' }
    }
    if (record.status === 'running') {
      return { success: true, instance: record }
    }
    if (!fs.existsSync(record.cwd) || !fs.statSync(record.cwd).isDirectory()) {
      reply.code(400)
      return { error: `Not a directory: ${record.cwd}` }
    }

    await scanInstances()
    const refreshed = getInstanceByPort(port)
    if (refreshed?.status === 'running') {
      if (normalizePathForCompare(refreshed.cwd) !== normalizePathForCompare(record.cwd)) {
        reply.code(409)
        return { error: `Port ${port} is already used by running server: ${refreshed.projectName}`, instance: refreshed }
      }
      return { success: true, instance: refreshed }
    }
    if (!(await isPortFree(port))) {
      reply.code(409)
      return { error: `Port ${port} is already in use`, instance: refreshed }
    }

    const { child, logPath } = spawnLocalInstance(cliEntry, record.cwd, port)
    const ready = await waitForLocalInstance(port, { pid: child.pid, cwd: record.cwd })
    if (!ready) {
      reply.code(500)
      return { error: `Server on port ${port} did not become ready as the requested instance. Check log: ${logPath}`, instance: getInstanceByPort(port), logPath }
    }
    const next = {
      ...record,
      pid: ready.pid || child.pid || 0,
      cwd: ready.projectDir || record.cwd,
      projectName: ready.projectName || record.projectName,
      startedAt: Date.now(),
      status: 'running' as const,
    }
    register(next)
    return { success: true, instance: next, logPath }
  })

  fastify.post('/api/instances/:port/stop', async (request, reply) => {
    const { port: portStr } = request.params as { port: string }
    const port = parseInt(portStr, 10)
    if (!Number.isFinite(port)) {
      reply.code(400)
      return { error: 'Invalid port' }
    }

    const record = getInstanceByPort(port)
    if (!record) {
      reply.code(404)
      return { error: 'Instance not found' }
    }

    const stopped = await stopLocalInstance(port)
    return { success: stopped, instance: getInstanceByPort(port) }
  })

  fastify.delete('/api/instances/:port', async (request, reply) => {
    const { port: portStr } = request.params as { port: string }
    const port = parseInt(portStr, 10)
    if (!Number.isFinite(port)) {
      reply.code(400)
      return { error: 'Invalid port' }
    }
    const record = getInstanceByPort(port)
    if (!record) {
      reply.code(404)
      return { error: 'Instance not found' }
    }
    if (record.status === 'running') {
      await stopLocalInstance(port)
    }
    removeByPort(port)
    return { success: true }
  })

  const webDistPath = resolveWebDistPath()
  if (!fs.existsSync(webDistPath)) {
    console.warn(`  [Warning] Frontend not found at ${webDistPath}`)
    console.warn(`  Run 'pnpm run build:web' to build the frontend, or use dev mode.`)
  }
  if (fs.existsSync(webDistPath)) {
    await fastify.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
    })

    fastify.setNotFoundHandler((_req, reply) => {
      reply.sendFile('index.html')
    })
  }

  return fastify
}

export async function startHub(port: number, cliEntry: string) {
  const fastify = await buildHubServer(cliEntry)
  await fastify.listen({ port, host: '0.0.0.0' })
  console.log(`Mexus Hub running at http://localhost:${port}`)

  const shutdown = async () => {
    await fastify.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  return { fastify }
}
