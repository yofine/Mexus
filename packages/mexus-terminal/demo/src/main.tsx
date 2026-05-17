import React, { useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@xterm/xterm/css/xterm.css'
import './styles.css'

import {
  createTuiTerminalRuntime,
  MexusPaneTerminal,
  MexusTerminalLaunchAdapter,
  type TerminalViewport,
} from '../../src'

type ServerMessage =
  | { type: 'ready' }
  | { type: 'output'; data: string }
  | { type: 'exit'; exitCode: number; signal?: number }

const presets = [
  {
    id: 'mock-tui',
    label: 'Mock TUI',
    command: 'node demo/mock-tui.mjs',
  },
  {
    id: 'claude',
    label: 'Claude Code',
    command: 'CLAUDE_CODE_NO_FLICKER=1 claude --permission-mode acceptEdits',
  },
  {
    id: 'codex',
    label: 'Codex',
    command: 'codex --no-alt-screen --dangerously-bypass-approvals-and-sandbox',
  },
  {
    id: 'shell',
    label: 'Shell',
    command: '',
  },
]

function buildSequentialPrompt(prefix: string, count: number): string {
  return [
    '请严格原样输出诊断行，不要解释，不要使用 Markdown 代码块。',
    `从 ${prefix}001 END 输出到 ${prefix}${String(count).padStart(3, '0')} END。`,
    '每个编号单独占一行，中间不要省略、不要合并、不要添加额外文字。',
  ].join(' ')
}

const diagnostics = [
  {
    id: 'ascii-fast',
    label: 'Agent T001-T040',
    prompt: buildSequentialPrompt('T', 40),
  },
  {
    id: 'ascii-slow',
    label: 'Agent S001-S020',
    prompt: buildSequentialPrompt('S', 20),
  },
  {
    id: 'markdown-mixed',
    label: 'Agent mixed',
    prompt: [
      '请严格输出一段用于终端渲染诊断的内容，不要解释。',
      '内容需要包含：',
      'L001 # Diagnostic Header；',
      'L002 普通段落；',
      'L003 - 列表项 alpha；',
      'L004 - 列表项 beta；',
      'L005 TypeScript 行：type TerminalChunk = { data: string }；',
      'L006 TypeScript 行：export function write(data: string) { return data.length }；',
      'L007 表格行：| name | value |；',
      'L008 表格行：| alpha | 1 |；',
      'L009 diff 删除行：- terminal.write(data);；',
      'L010 diff 新增行：+ terminal.write(chunk);；',
      'L011 done。',
      '每个 L 编号必须单独占一行。',
    ].join(' '),
  },
  {
    id: 'long-lines',
    label: 'Long wrap',
    prompt: [
      '请严格原样输出用于终端换行诊断的内容，不要解释。',
      '输出 W001 到 W012，每个编号单独占一行。',
      '每一行格式为：W编号 + 空格 + 一段超过 160 个英文字符的连续描述文本。',
      '每行都必须包含尾标记 WRAP-END。',
      '不要省略任何行，不要使用 Markdown 代码块。',
    ].join(' '),
  },
  {
    id: 'unicode-wide',
    label: 'Unicode wide',
    prompt: [
      '请严格原样输出用于终端宽字符诊断的内容，不要解释。',
      '输出 U001 到 U020，每个编号单独占一行。',
      '内容混合中文、英文、数字、emoji 和路径，例如：',
      'U001 中文宽字符 mixed ASCII 123 /root/workspace/Nexus ✅ END。',
      '必须完整输出 U001 到 U020，不要省略，不要合并。',
    ].join(' '),
  },
  {
    id: 'dense-list',
    label: 'Dense list',
    prompt: [
      '请严格输出一个高密度列表，不要解释。',
      '输出 D001 到 D060，每个编号单独占一行。',
      '每行格式：D编号 | status=ok | file=packages/mexus-terminal/src/core/terminal-session.ts | note=render-check END。',
      '不要使用 Markdown 代码块，不要省略任何编号。',
    ].join(' '),
  },
  {
    id: 'code-blocks',
    label: 'Code blocks',
    prompt: [
      '请严格输出用于代码块渲染诊断的内容，不要解释。',
      '包含三个 fenced code block：typescript、diff、bash。',
      '每个代码块内部都要有 C001 到 C030 中连续编号的行，编号不能缺失。',
      '代码块前后各输出一行纯文本边界：CODE-BLOCK-START 和 CODE-BLOCK-END。',
    ].join(' '),
  },
  {
    id: 'tables',
    label: 'Tables',
    prompt: [
      '请严格输出用于表格渲染诊断的内容，不要解释。',
      '输出一个 Markdown 表格，包含表头和 A001 到 A030 共 30 行数据。',
      '列为 id、agent、status、path、note。',
      '每行的 note 末尾都必须是 TABLE-END。',
      '表格后再输出 SUMMARY A001-A030 COMPLETE。',
    ].join(' '),
  },
  {
    id: 'blank-lines',
    label: 'Blank lines',
    prompt: [
      '请严格输出用于空行和段落边界诊断的内容，不要解释。',
      '输出 B001 到 B020。',
      '每个编号行后面跟一个空行。',
      '每 5 个编号后输出一行 SECTION-BREAK。',
      '确保 B001 到 B020 全部出现。',
    ].join(' '),
  },
  {
    id: 'stress-120',
    label: 'Stress 120',
    prompt: [
      '请严格输出压力测试内容，不要解释。',
      '输出 P001 到 P120，每个编号单独占一行。',
      '每行格式：P编号 END。',
      '不要省略任何编号，不要分组概括，不要使用省略号。',
    ].join(' '),
  },
]

const runtime = createTuiTerminalRuntime()
const session = runtime.createTerminal({ id: 'demo-pane' })

function App() {
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
    <main className="demo-shell">
      <header className="demo-header">
        <div>
          <div className="demo-kicker">Mexus Terminal Runtime</div>
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
        <button className="primary" onClick={start}>Start</button>
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
          options={{
            cursorBlink: true,
            fontFamily: 'JetBrains Mono, SFMono-Regular, Menlo, monospace',
            fontSize: 13,
            theme: {
              background: '#0f0f0f',
              foreground: '#e7e5df',
              cursor: '#3CCFAB',
              selectionBackground: '#2ab89a33',
            },
          }}
          onInput={(data) => {
            socketRef.current?.send(JSON.stringify({ type: 'input', data }))
          }}
          onResize={(viewport) => {
            viewportRef.current = viewport
            socketRef.current?.send(JSON.stringify({ type: 'resize', ...viewport }))
          }}
        />
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
