import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaneState } from '@/types'
import {
  AgentPane,
  EXPANDED_TERMINAL_FINAL_SYNC_DELAY_MS,
  EXPANDED_TERMINAL_SCROLL_SETTLE_DELAYS_MS,
  EXPANDED_TERMINAL_SYNC_DELAY_MS,
  HIDDEN_TERMINAL_PARKING_HEIGHT,
  HIDDEN_TERMINAL_PARKING_WIDTH,
  scheduleExpandedTerminalLayoutSync,
} from './AgentPane'

const terminalRegistryMocks = vi.hoisted(() => ({
  refitTerminal: vi.fn(),
  scrollTerminalToBottom: vi.fn(),
  getTerminalDimensions: vi.fn(() => ({ cols: 120, rows: 32 })),
  unpauseTerminal: vi.fn(),
}))

vi.mock('./Terminal', () => ({
  Terminal: ({ visible, bufferWhenHidden }: { visible?: boolean; bufferWhenHidden?: boolean }) => (
    <div
      data-testid="terminal"
      data-visible={String(Boolean(visible))}
      data-buffer-when-hidden={String(Boolean(bufferWhenHidden))}
    />
  ),
}))

vi.mock('@/stores/terminalRegistry', () => terminalRegistryMocks)

beforeEach(() => {
  vi.clearAllMocks()
})

function pane(overrides: Partial<PaneState> = {}): PaneState {
  return {
    id: 'pane-1',
    name: 'Codex',
    agent: 'codex',
    restore: 'restart',
    isolation: 'shared',
    runtime: 'pty',
    status: 'running',
    meta: {},
    ...overrides,
  }
}

describe('AgentPane header', () => {
  it('keeps status chips and the dedicated collapse button out of the expanded header', () => {
    const html = renderToStaticMarkup(
      <AgentPane
        pane={pane({ meta: { model: 'gpt-5.3', contextUsedPct: 42, costUsd: 1.25 } })}
        paneIndex={0}
        isExpanded
        onToggle={() => {}}
        send={() => {}}
      />,
    )

    expect(html).not.toContain('agent-pane-header__meta')
    expect(html).not.toContain('agent-pane-meta-chip')
    expect(html).not.toContain('agent-pane-collapse-btn')
  })

  it('renders hover descriptions for the visible action buttons', () => {
    const html = renderToStaticMarkup(
      <AgentPane
        pane={pane()}
        paneIndex={0}
        isExpanded
        isPinned={false}
        onToggle={() => {}}
        onTogglePin={() => {}}
        send={() => {}}
      />,
    )

    expect(html).toContain('data-tooltip="Pin to top"')
    expect(html).toContain('data-tooltip="Edit title"')
    expect(html).toContain('data-tooltip="Send Ctrl+C (interrupt)"')
    expect(html).toContain('data-tooltip="Restart (new session)"')
    expect(html).toContain('data-tooltip="Close"')
  })

  it('renders an unpin action when the pane is pinned', () => {
    const html = renderToStaticMarkup(
      <AgentPane
        pane={pane()}
        paneIndex={0}
        isExpanded
        isPinned
        onToggle={() => {}}
        onTogglePin={() => {}}
        send={() => {}}
      />,
    )

    expect(html).toContain('data-tooltip="Unpin from top"')
  })

  it('renders the pin action as the rightmost toolbar button', () => {
    const html = renderToStaticMarkup(
      <AgentPane
        pane={pane()}
        paneIndex={0}
        isExpanded
        onToggle={() => {}}
        onTogglePin={() => {}}
        send={() => {}}
      />,
    )

    expect(html.indexOf('data-tooltip="Close"')).toBeLessThan(html.indexOf('data-tooltip="Pin to top"'))
  })

  it('uses the pane color provided by the parent list', () => {
    const html = renderToStaticMarkup(
      <AgentPane
        pane={pane()}
        paneIndex={0}
        paneColor="#ABCDEF"
        isExpanded
        onToggle={() => {}}
        send={() => {}}
      />,
    )

    expect(html).toContain('--pane-color:#ABCDEF')
  })

  it('parks the hidden terminal in the viewport without allowing it to resize the PTY', () => {
    const html = renderToStaticMarkup(
      <AgentPane
        pane={pane()}
        paneIndex={0}
        isExpanded={false}
        onToggle={() => {}}
        send={() => {}}
      />,
    )

    expect(html).toContain('position:fixed')
    expect(html).toContain(`width:${HIDDEN_TERMINAL_PARKING_WIDTH}`)
    expect(html).toContain(`height:${HIDDEN_TERMINAL_PARKING_HEIGHT}`)
  })

  it('marks collapsed terminals as not visible so they do not resize the PTY while hidden', () => {
    const html = renderToStaticMarkup(
      <AgentPane
        pane={pane()}
        paneIndex={0}
        isExpanded={false}
        onToggle={() => {}}
        send={() => {}}
      />,
    )

    expect(html).toContain('data-visible="false"')
    expect(html).toContain('data-buffer-when-hidden="false"')
  })
})

describe('scheduleExpandedTerminalLayoutSync', () => {
  it('syncs xterm after the first layout pass and after the pane transition settles', () => {
    vi.useFakeTimers()
    const rafCallbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback)
      return rafCallbacks.length
    }))
    const send = vi.fn()

    scheduleExpandedTerminalLayoutSync('pane-1', send)

    expect(terminalRegistryMocks.refitTerminal).not.toHaveBeenCalled()

    const firstFrame = rafCallbacks.shift()
    firstFrame?.(0)
    const secondFrame = rafCallbacks.shift()
    secondFrame?.(0)

    expect(terminalRegistryMocks.refitTerminal).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith({
      type: 'terminal.resize',
      paneId: 'pane-1',
      cols: 120,
      rows: 32,
    })
    expect(terminalRegistryMocks.scrollTerminalToBottom).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(EXPANDED_TERMINAL_SYNC_DELAY_MS)

    expect(terminalRegistryMocks.refitTerminal).toHaveBeenCalledTimes(2)
    expect(terminalRegistryMocks.scrollTerminalToBottom).toHaveBeenCalledTimes(3)

    vi.advanceTimersByTime(EXPANDED_TERMINAL_FINAL_SYNC_DELAY_MS - EXPANDED_TERMINAL_SYNC_DELAY_MS)

    expect(terminalRegistryMocks.refitTerminal).toHaveBeenCalledTimes(3)
    expect(terminalRegistryMocks.scrollTerminalToBottom).toHaveBeenCalledTimes(5)
    expect(send).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(EXPANDED_TERMINAL_SCROLL_SETTLE_DELAYS_MS[2] - EXPANDED_TERMINAL_FINAL_SYNC_DELAY_MS)

    expect(terminalRegistryMocks.scrollTerminalToBottom).toHaveBeenCalledTimes(6)
    expect(send).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('cancels the settled sync when the pane changes before the transition completes', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    const cleanup = scheduleExpandedTerminalLayoutSync('pane-1', vi.fn())

    cleanup()
    vi.advanceTimersByTime(EXPANDED_TERMINAL_FINAL_SYNC_DELAY_MS)

    expect(terminalRegistryMocks.refitTerminal).not.toHaveBeenCalled()

    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
})
