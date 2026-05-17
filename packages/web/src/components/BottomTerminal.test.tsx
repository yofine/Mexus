import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { BottomTerminalHeader } from './BottomTerminal'

vi.mock('./Terminal', () => ({
  Terminal: () => <div data-testid="terminal" />,
}))

describe('BottomTerminalHeader', () => {
  it('renders the minimize action as the rightmost header button', () => {
    const html = renderToStaticMarkup(
      <BottomTerminalHeader
        isMaximized={false}
        onClose={() => {}}
        onToggleMaximize={() => {}}
        airline={<span>status</span>}
      />,
    )

    expect(html.indexOf('data-label="Maximize"')).toBeLessThan(html.indexOf('data-label="Minimize"'))
  })
})
