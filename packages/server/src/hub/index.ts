import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  findFreePort,
  getInstanceByPort,
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

function addCorsHeaders(reply: { header: (name: string, value: string) => void }) {
  reply.header('Access-Control-Allow-Origin', '*')
  reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function resolveWebDistPath(): string {
  return path.resolve(__dirname, '../../web/dist')
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

    let assignedPort: number
    try {
      assignedPort = body.port || (await findFreePort(7700, 7800))
    } catch (err) {
      reply.code(503)
      return { error: (err as Error).message }
    }

    const { child, logPath } = spawnLocalInstance(cliEntry, cwd, assignedPort)
    const projectName = path.basename(cwd)
    register({
      pid: child.pid || 0,
      port: assignedPort,
      cwd,
      projectName,
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

    const { child, logPath } = spawnLocalInstance(cliEntry, record.cwd, port)
    const next = {
      ...record,
      pid: child.pid || 0,
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
