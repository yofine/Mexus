import { createServer as createHttpServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'
import pty from 'node-pty'
import react from '@vitejs/plugin-react'
import { createServer as createViteServer } from 'vite'
import { WebSocketServer } from 'ws'

const demoRoot = path.dirname(fileURLToPath(import.meta.url))
const port = Number.parseInt(process.env.MEXUS_TERMINAL_DEMO_PORT ?? '5178', 10)
const host = process.env.MEXUS_TERMINAL_DEMO_HOST ?? '0.0.0.0'
const hmrPort = Number.parseInt(process.env.MEXUS_TERMINAL_DEMO_HMR_PORT ?? String(port + 19000), 10)

type ClientMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'restart-shell' }

function getShell(): string {
  return process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : 'bash')
}

function buildPtyEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== 'NO_COLOR') {
      env[key] = value
    }
  }

  env.TERM = 'xterm-256color'
  env.COLORTERM = 'truecolor'
  env.FORCE_COLOR = '1'
  env.CLICOLOR = '1'
  env.CLICOLOR_FORCE = '1'
  env.MEXUS_TERMINAL_DEMO = '1'

  return env
}

const vite = await createViteServer({
  root: demoRoot,
  server: {
    middlewareMode: true,
    hmr: {
      host: host === '0.0.0.0' ? 'localhost' : host,
      port: hmrPort,
    },
    watch: {
      usePolling: true,
      interval: 300,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/.nexus/**',
      ],
    },
  },
  plugins: [react()],
  appType: 'spa',
})

const server = createHttpServer((req, res) => {
  vite.middlewares(req, res, () => {
    res.statusCode = 404
    res.end('Not found')
  })
})

const wss = new WebSocketServer({ server, path: '/pty' })

wss.on('connection', (socket) => {
  let term = pty.spawn(getShell(), [], {
    name: 'xterm-256color',
    cols: 120,
    rows: 32,
    cwd: process.cwd(),
    env: buildPtyEnv(),
  })

  const send = (payload: unknown) => {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(payload))
    }
  }

  const wirePty = () => {
    term.onData((data) => send({ type: 'output', data }))
    term.onExit(({ exitCode, signal }) => {
      send({ type: 'exit', exitCode, signal })
    })
  }

  wirePty()
  send({ type: 'ready' })

  socket.on('message', (raw) => {
    let message: ClientMessage
    try {
      message = JSON.parse(String(raw)) as ClientMessage
    } catch {
      return
    }

    if (message.type === 'input') {
      term.write(message.data)
      return
    }

    if (message.type === 'resize') {
      if (Number.isFinite(message.cols) && Number.isFinite(message.rows)) {
        term.resize(Math.max(2, message.cols), Math.max(2, message.rows))
      }
      return
    }

    if (message.type === 'restart-shell') {
      term.kill()
      term = pty.spawn(getShell(), [], {
        name: 'xterm-256color',
        cols: 120,
        rows: 32,
        cwd: process.cwd(),
        env: buildPtyEnv(),
      })
      wirePty()
      send({ type: 'ready' })
    }
  })

  socket.on('close', () => {
    term.kill()
  })
})

server.listen(port, host, () => {
  const displayHost = host === '0.0.0.0' ? 'localhost' : host
  console.log(`Mexus terminal PTY demo: http://${displayHost}:${port}`)
  if (host === '0.0.0.0') {
    console.log(`Listening on all interfaces: http://0.0.0.0:${port}`)
  }
})
