#!/usr/bin/env node
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'

function parseArgs(argv) {
  const args = { root: process.cwd(), port: 4179, host: '0.0.0.0', publicHost: '' }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root') args.root = argv[++i] || args.root
    else if (argv[i] === '--port') args.port = Number(argv[++i] || args.port)
    else if (argv[i] === '--host') args.host = argv[++i] || args.host
    else if (argv[i] === '--public-host') args.publicHost = argv[++i] || args.publicHost
  }
  return args
}

function listen(server, port, host) {
  return new Promise((resolve) => {
    const onError = (error) => {
      server.off('listening', onListening)
      resolve({ ok: false, error })
    }
    const onListening = () => {
      server.off('error', onError)
      resolve({ ok: true, error: null })
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, host)
  })
}

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}

function firstExternalAddress() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) return address.address
    }
  }
  return '127.0.0.1'
}

function displayHost(bindHost, publicHost) {
  if (publicHost) return publicHost
  if (bindHost === '0.0.0.0' || bindHost === '::') return firstExternalAddress()
  return bindHost
}

function field(markdown, label) {
  return markdown.match(new RegExp(`^${label}:\\s*(.*)$`, 'm'))?.[1]?.trim() || ''
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const root = path.resolve(args.root)
  const agentTeamDir = path.join(root, 'agent-team')
  if (!fs.existsSync(agentTeamDir)) {
    console.error('No agent-team/ directory found. Run /mexus-skill:team "<request>" first.')
    process.exit(1)
  }

  const apiServer = http.createServer((req, res) => {
    if (!req.url?.startsWith('/api/agent-team')) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    const missionsDir = path.join(agentTeamDir, 'missions')
    const missions = fs.existsSync(missionsDir)
      ? fs.readdirSync(missionsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
        .map((entry) => {
          const dir = path.join(missionsDir, entry.name)
          const mission = readText(path.join(dir, 'mission.md'))
          const mtime = Math.max(
            fs.existsSync(path.join(dir, 'mission.md')) ? fs.statSync(path.join(dir, 'mission.md')).mtimeMs : 0,
            fs.existsSync(path.join(dir, 'kanban.md')) ? fs.statSync(path.join(dir, 'kanban.md')).mtimeMs : 0,
            fs.existsSync(path.join(dir, 'roundtable.md')) ? fs.statSync(path.join(dir, 'roundtable.md')).mtimeMs : 0,
          )
          return {
            name: entry.name,
            mission,
            agents: readText(path.join(dir, 'agents.md')),
            kanban: readText(path.join(dir, 'kanban.md')),
            roundtable: readText(path.join(dir, 'roundtable.md')),
            squadLead: readText(path.join(dir, 'squad-lead.md')),
            lifecycle: field(mission, 'Lifecycle'),
            createdAt: field(mission, 'Created at'),
            mtime,
          }
        })
        .sort((a, b) => {
          if (a.lifecycle === 'active' && b.lifecycle !== 'active') return -1
          if (b.lifecycle === 'active' && a.lifecycle !== 'active') return 1
          const created = String(b.createdAt).localeCompare(String(a.createdAt))
          if (created !== 0) return created
          return b.mtime - a.mtime || a.name.localeCompare(b.name)
        })
        .map(({ lifecycle, createdAt, mtime, ...mission }) => mission)
      : []
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    })
    res.end(JSON.stringify({
      projectRoot: root,
      workflow: readText(path.join(agentTeamDir, 'mission-workflow.md')),
      roster: readText(path.join(agentTeamDir, 'agents.md')),
      missions,
    }))
  })

  let apiPort = args.port + 1000
  while (apiPort < 65536) {
    const result = await listen(apiServer, apiPort, args.host)
    if (result.ok) break
    if (result.error?.code !== 'EADDRINUSE') {
      throw new Error(`Failed to bind Agent Team API on ${args.host}:${apiPort}: ${result.error?.message || result.error}`)
    }
    apiPort += 1
  }
  if (apiPort >= 65536) throw new Error(`No available API port found for host ${args.host}`)

  const publicHost = displayHost(args.host, args.publicHost)
  const boardUrl = `http://${publicHost}:${args.port}`
  const apiUrl = `http://${publicHost}:${apiPort}/api/agent-team`

  const appDir = path.resolve(new URL('../skills/board/board-app', import.meta.url).pathname)
  const vite = spawn('pnpm', ['--dir', appDir, 'dev', '--host', args.host, '--port', String(args.port)], {
    cwd: root,
    env: { ...process.env, AGENT_TEAM_API_PORT: String(apiPort) },
    stdio: 'inherit',
  })

  const stateDir = path.join(root, '.mexus-agent-team')
  fs.mkdirSync(stateDir, { recursive: true })
  const state = {
    pid: process.pid,
    vitePid: vite.pid,
    host: args.host,
    publicHost,
    url: boardUrl,
    apiUrl,
    projectRoot: root,
    startedAt: new Date().toISOString(),
  }
  fs.writeFileSync(path.join(stateDir, 'board.json'), JSON.stringify(state, null, 2))
  console.log(`Agent Team board: ${state.url}`)
  console.log(`Agent Team API: ${state.apiUrl}`)

  const cleanup = () => {
    try { vite.kill('SIGTERM') } catch {}
    try { apiServer.close() } catch {}
    try { fs.rmSync(path.join(stateDir, 'board.json'), { force: true }) } catch {}
  }
  process.on('SIGINT', () => { cleanup(); process.exit(0) })
  process.on('SIGTERM', () => { cleanup(); process.exit(0) })
}

main()
