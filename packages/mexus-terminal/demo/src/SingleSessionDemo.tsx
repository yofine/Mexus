import { useMemo, useRef, useState } from 'react'

import {
  createTuiTerminalRuntime,
  MexusPaneTerminal,
  MexusTerminalLaunchAdapter,
  type TerminalViewport,
} from '../../src'
import {
  diagnostics,
  presets,
  terminalOptions,
  type ServerMessage,
} from './demo-data'

const runtime = createTuiTerminalRuntime()
const session = runtime.createTerminal({ id: 'demo-pane' })

export function SingleSessionDemo() {
  const socketRef = useRef<WebSocket | null>(null)
  const viewportRef = useRef<TerminalViewport | null>(null)
  const [status, setStatus] = useState('disconnected')
  const [selectedPreset, setSelectedPreset] = useState(presets[0].id)
  const [command, setCommand] = useState(presets[0].command)

  const launchAdapter = useMemo(
    () =>
      new MexusTerminalLaunchAdapter({
        writeInput: (_paneId, data) => {
          socketRef.current?.send(JSON.stringify({ type: 'input', data }))
        },
      }),
    [],
  )

  const connect = () => {
    socketRef.current?.close()
    const socket = new WebSocket(`ws://${window.location.host}/pty`)
    socketRef.current = socket
    setStatus('connecting')

    socket.addEventListener('open', () => {
      setStatus('connected')
      const viewport = viewportRef.current
      if (viewport) {
        socket.send(JSON.stringify({ type: 'resize', ...viewport }))
      }
    })

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as ServerMessage
      if (message.type === 'ready') {
        launchAdapter.markTerminalReady('demo-pane')
        return
      }
      if (message.type === 'output') {
        session.writeLive(message.data)
        return
      }
      if (message.type === 'exit') {
        session.writeLive(`\r\n[process exited: ${message.exitCode}]\r\n`)
      }
    })

    socket.addEventListener('close', () => {
      setStatus('disconnected')
    })
  }

  const start = async () => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      connect()
      await new Promise((resolve) => window.setTimeout(resolve, 250))
    }
    if (command.trim().length === 0) {
      return
    }
    await launchAdapter.launchResolvedTerminalAgent({
      paneId: 'demo-pane',
      command,
    })
  }

  const runDiagnostic = async (prompt: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setStatus('start an agent first')
      return
    }

    socketRef.current.send(JSON.stringify({ type: 'input', data: prompt }))
  }

  const restartShell = () => {
    session.writeLive('\x1b[2J\x1b[H')
    socketRef.current?.send(JSON.stringify({ type: 'restart-shell' }))
  }

  return (
    <section className="demo-module">
      <header className="demo-header">
        <div>
          <div className="demo-kicker">Single session</div>
          <h1>Real node-pty TUI demo</h1>
        </div>
        <div className="demo-status">{status}</div>
      </header>

      <section className="demo-toolbar">
        <select
          value={selectedPreset}
          onChange={(event) => {
            const preset = presets.find((item) => item.id === event.target.value) ?? presets[0]
            setSelectedPreset(preset.id)
            setCommand(preset.command)
          }}
        >
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
        <input
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          placeholder="CLI command"
        />
        <button onClick={connect}>Connect</button>
        <button className="primary" onClick={() => void start()}>Start</button>
        <button onClick={restartShell}>Restart shell</button>
      </section>

      <section className="diagnostic-strip">
        <span>Agent diagnostics</span>
        {diagnostics.map((diagnostic) => (
          <button
            key={diagnostic.id}
            onClick={() => {
              void runDiagnostic(diagnostic.prompt)
            }}
          >
            {diagnostic.label}
          </button>
        ))}
      </section>

      <section className="terminal-frame">
        <MexusPaneTerminal
          paneId="demo-pane"
          runtime={runtime}
          visible
          className="terminal-host"
          options={terminalOptions}
          onInput={(data) => {
            socketRef.current?.send(JSON.stringify({ type: 'input', data }))
          }}
          onResize={(viewport) => {
            viewportRef.current = viewport
            socketRef.current?.send(JSON.stringify({ type: 'resize', ...viewport }))
          }}
        />
      </section>
    </section>
  )
}
