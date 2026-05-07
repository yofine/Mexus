import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { MissionKanbanParseResult } from '@/stores/missionStore'
import { MissionKanban } from './MissionKanban'

const SAMPLE_KANBAN: MissionKanbanParseResult = {
  ok: true,
  raw: '',
  counts: { toClaim: 1, inProgress: 0, done: 0, unreviewedDone: 0 },
  tasks: [
    {
      id: 'abc123',
      status: 'To Claim',
      to: 'Vassago',
      from: 'Squad Lead',
      scope: 'packages/web/src/components/missions/MissionKanban.tsx',
      ref: 'abc123',
      request: 'Optimize the mission task card.',
      reason: 'Cards are too dense.',
      acceptance: 'This verbose acceptance text should not render on the compact card.',
      result: '',
      files: '',
      verification: '',
      review: '',
      updated: '2026-05-08, Squad Lead',
      raw: '',
      line: 42,
    },
  ],
}

describe('MissionKanban', () => {
  it('renders compact task card metadata and a review badge', () => {
    const html = renderToStaticMarkup(createElement(MissionKanban, { kanban: SAMPLE_KANBAN }))

    expect(html).toContain('abc123')
    expect(html).toContain('Vassago')
    expect(html).toContain('Squad Lead')
    expect(html).toContain('Vassago')
    expect(html).not.toContain('To: Vassago')
    expect(html).not.toContain('From: Squad Lead')
    expect(html).not.toContain('Acceptance')
    expect(html).not.toContain('This verbose acceptance text')
    expect(html).toContain('mission-review-badge')
  })
})
