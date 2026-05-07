import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MissionAgents } from './MissionAgents'
import type { MissionAgentsParseResult } from '@/stores/missionStore'

const agents: MissionAgentsParseResult = {
  ok: true,
  raw: '',
  agents: [
    {
      name: 'Vassago',
      responsibility: 'Hub Team tab, Mission store, Mission selector, and overview UI.',
      activationPromptSummary: 'Activation prompt text should stay in agents.md.',
      initialPromptSummary: 'Initial prompt text should stay in agents.md.',
      taskCounts: { toClaim: 2, inProgress: 1, done: 4, total: 7 },
    },
  ],
}

describe('MissionAgents roster cards', () => {
  it('renders team profile cards without prompt summaries', () => {
    const html = renderToStaticMarkup(createElement(MissionAgents, { agents }))

    expect(html).toContain('mission-agent-avatar')
    expect(html).toContain('V')
    expect(html).toContain('Vassago')
    expect(html).toContain('Hub Team tab, Mission store, Mission selector, and overview UI.')
    expect(html).toContain('2 to claim')
    expect(html).toContain('1 active')
    expect(html).toContain('4 done')
    expect(html).not.toContain('Activation prompt text should stay in agents.md.')
    expect(html).not.toContain('Initial prompt text should stay in agents.md.')
  })
})
