#!/usr/bin/env node
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'

function parseArgs(argv) {
  const args = { root: process.cwd(), port: 4179 }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root') args.root = argv[++i] || args.root
    else if (argv[i] === '--port') args.port = Number(argv[++i] || args.port)
  }
  return args
}

function listen(server, port) {
  return new Promise((resolve) => {
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => resolve(true))
  })
}

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const root = path.resolve(args.root)
  const agentTeamDir = path.join(root, 'agent-team')
  if (!fs.existsSync(agentTeamDir)) {
    console.error('No agent-team/ directory found. Run /team "<request>" first.')
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
          return {
            name: entry.name,
            mission: readText(path.join(dir, 'mission.md')),
            agents: readText(path.join(dir, 'agents.md')),
            kanban: readText(path.join(dir, 'kanban.md')),
            roundtable: readText(path.join(dir, 'roundtable.md')),
            squadLead: readText(path.join(dir, 'squad-lead.md')),
          }
        })
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
  while (!(await listen(apiServer, apiPort))) apiPort += 1

  const appDir = path.resolve(new URL('../skills/board/board-app', import.meta.url).pathname)
  const vite = spawn('pnpm', ['--dir', appDir, 'dev', '--host', '127.0.0.1', '--port', String(args.port)], {
    cwd: root,
    env: { ...process.env, VITE_AGENT_TEAM_API_URL: `http://127.0.0.1:${apiPort}/api/agent-team` },
    stdio: 'inherit',
  })

  const stateDir = path.join(root, '.mexus-agent-team')
  fs.mkdirSync(stateDir, { recursive: true })
  const state = {
    pid: process.pid,
    vitePid: vite.pid,
    url: `http://127.0.0.1:${args.port}`,
    apiUrl: `http://127.0.0.1:${apiPort}/api/agent-team`,
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
