import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MissionOverview } from './MissionOverview'

describe('MissionOverview', () => {
  it('renders a slim overview without duplicated task stats or acceptance summary', () => {
    const html = renderToStaticMarkup(createElement(MissionOverview, {
      mission: { name: 'hub-agent-team-mission-mvp', lifecycle: 'active' },
      overview: {
        name: 'Hub Agent Team Mission MVP',
        lifecycle: 'active',
        date: '2026-05-08',
        intent: 'Build the Hub Team observation surface.',
        acceptance: ['Ship the Team tab.', 'Render Mission data.'],
      },
      kanban: {
        ok: true,
        raw: '',
        tasks: [],
        counts: { toClaim: 2, inProgress: 1, done: 3, unreviewedDone: 1 },
      },
    }))

    expect(html).toContain('Hub Agent Team Mission MVP')
    expect(html).toContain('Build the Hub Team observation surface.')
    expect(html).not.toContain('To Claim')
    expect(html).not.toContain('In Progress')
    expect(html).not.toContain('Done')
    expect(html).not.toContain('Unreviewed')
    expect(html).not.toContain('Ship the Team tab.')
  })
})
