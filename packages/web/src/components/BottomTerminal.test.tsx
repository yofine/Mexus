import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { BottomTerminalHeader } from './BottomTerminal'

vi.mock('./Terminal', () => ({
  Terminal: () => <div data-testid="terminal" />,
}))

describe('BottomTerminalHeader', () => {
  it('renders the minimize action immediately after the status strip', () => {
    const html = renderToStaticMarkup(
      <BottomTerminalHeader
        isMaximized={false}
        onClose={() => {}}
        onToggleMaximize={() => {}}
        airline={<span>status</span>}
      />,
    )

    expect(html.indexOf('status')).toBeLessThan(html.indexOf('data-label="Minimize"'))
    expect(html.indexOf('data-label="Minimize"')).toBeLessThan(html.indexOf('data-label="Maximize"'))
  })
})
