import { useMemo, useRef, useState } from 'react'

import {
  createTuiTerminalRuntime,
  MexusTerminalLaunchAdapter,
  TuiTerminalStage,
  type TerminalViewport,
} from '../../src'
import {
  diagnostics,
  presets,
  terminalOptions,
  type ServerMessage,
} from './demo-data'

const runtime = createTuiTerminalRuntime()

const demoSessions = [
  { id: 'demo-a', label: 'Pane A' },
  { id: 'demo-b', label: 'Pane B' },
  { id: 'demo-c', label: 'Pane C' },
]

function getRuntimeSession(sessionId: string) {
  return runtime.getTerminal(sessionId) ?? runtime.createTerminal({ id: sessionId })
}

export function StageStackDemo() {
  const socketsRef = useRef(new Map<string, WebSocket>())
  const viewportRef = useRef(new Map<string, TerminalViewport>())
  const [activeSessionId, setActiveSessionId] = useState(demoSessions[0].id)
  const [statuses, setStatuses] = useState<Record<string, string>>(() => Object.fromEntries(
    demoSessions.map((session) => [session.id, 'disconnected']),
  ))
  const [selectedPreset, setSelectedPreset] = useState(presets[0].id)
  const [command, setCommand] = useState(presets[0].command)

  const launchAdapter = useMemo(
    () =>
      new MexusTerminalLaunchAdapter({
        writeInput: (paneId, data) => {
          socketsRef.current.get(paneId)?.send(JSON.stringify({ type: 'input', data }))
        },
      }),
    [],
  )

  const setSessionStatus = (sessionId: string, status: string) => {
    setStatuses((current) => ({ ...current, [sessionId]: status }))
  }

  const connect = (sessionId = activeSessionId) => {
    socketsRef.current.get(sessionId)?.close()
    const socket = new WebSocket(`ws://${window.location.host}/pty`)
    socketsRef.current.set(sessionId, socket)
    setSessionStatus(sessionId, 'connecting')

    socket.addEventListener('open', () => {
      setSessionStatus(sessionId, 'connected')
      const viewport = viewportRef.current.get(sessionId)
      if (viewport) {
        socket.send(JSON.stringify({ type: 'resize', ...viewport }))
      }
    })

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as ServerMessage
      if (message.type === 'ready') {
        launchAdapter.markTerminalReady(sessionId)
        return
      }
      if (message.type === 'output') {
        getRuntimeSession(sessionId).writeLive(message.data)
        return
      }
      if (message.type === 'exit') {
        getRuntimeSession(sessionId).writeLive(`\r\n[process exited: ${message.exitCode}]\r\n`)
      }
    })

    socket.addEventListener('close', () => {
      setSessionStatus(sessionId, 'disconnected')
    })
  }

  const connectAll = () => {
    for (const session of demoSessions) {
      connect(session.id)
    }
  }

  const start = async (sessionId = activeSessionId) => {
    const socket = socketsRef.current.get(sessionId)
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      connect(sessionId)
      await new Promise((resolve) => window.setTimeout(resolve, 250))
    }
    if (command.trim().length === 0) {
      return
    }
    await launchAdapter.launchResolvedTerminalAgent({
      paneId: sessionId,
      command,
    })
  }

  const runDiagnostic = async (prompt: string) => {
    const socket = socketsRef.current.get(activeSessionId)
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setSessionStatus(activeSessionId, 'start an agent first')
      return
    }

    socket.send(JSON.stringify({ type: 'input', data: prompt }))
  }

  const restartShell = (sessionId = activeSessionId) => {
    getRuntimeSession(sessionId).writeLive('\x1b[2J\x1b[H')
    socketsRef.current.get(sessionId)?.send(JSON.stringify({ type: 'restart-shell' }))
  }

  const sendBackgroundBurst = (sessionId: string) => {
    const socket = socketsRef.current.get(sessionId)
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setSessionStatus(sessionId, 'connect first')
      return
    }

    socket.send(JSON.stringify({
      type: 'input',
      data: `for i in $(seq -w 1 120); do echo ${sessionId.toUpperCase()}-BG-$i; sleep 0.02; done\r`,
    }))
  }

  return (
    <section className="demo-module demo-module--stage">
      <header className="demo-header">
        <div>
          <div className="demo-kicker">Stage stack</div>
          <h1>Multi-session TUI stage demo</h1>
        </div>
        <div className="demo-status">active: {activeSessionId}</div>
      </header>

      <section className="demo-toolbar demo-toolbar--stage">
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
        <button onClick={() => connect(activeSessionId)}>Connect active</button>
        <button onClick={connectAll}>Connect all</button>
        <button className="primary" onClick={() => void start(activeSessionId)}>Start active</button>
        <button onClick={() => restartShell(activeSessionId)}>Restart active</button>
      </section>

      <section className="session-strip">
        {demoSessions.map((session) => {
          const active = session.id === activeSessionId
          return (
            <button
              key={session.id}
              className={active ? 'active' : ''}
              onClick={() => setActiveSessionId(session.id)}
            >
              <strong>{session.label}</strong>
              <span>{statuses[session.id]}</span>
            </button>
          )
        })}
        <button onClick={() => sendBackgroundBurst('demo-b')}>BG burst B</button>
        <button onClick={() => sendBackgroundBurst('demo-c')}>BG burst C</button>
      </section>

      <section className="diagnostic-strip">
        <span>Prompt inserts into active session</span>
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
        <TuiTerminalStage
          sessionIds={demoSessions.map((session) => session.id)}
          activeSessionId={activeSessionId}
          runtime={runtime}
          className="terminal-stage"
          terminalClassName="terminal-host"
          terminalOptions={terminalOptions}
          onInput={(sessionId, data) => {
            socketsRef.current.get(sessionId)?.send(JSON.stringify({ type: 'input', data }))
          }}
          onResize={(sessionId, viewport) => {
            viewportRef.current.set(sessionId, viewport)
            socketsRef.current.get(sessionId)?.send(JSON.stringify({ type: 'resize', ...viewport }))
          }}
        />
      </section>
    </section>
  )
}
