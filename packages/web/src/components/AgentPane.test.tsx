import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { PaneState } from '@/types'
import { AgentPane } from './AgentPane'

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

  it('does not render terminal surfaces inside pane rows', () => {
    const html = renderToStaticMarkup(
      <AgentPane
        pane={pane()}
        paneIndex={0}
        isExpanded={false}
        onToggle={() => {}}
        send={() => {}}
      />,
    )

    expect(html).not.toContain('terminal-container')
  })
})
