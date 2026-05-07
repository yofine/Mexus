import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useMissionStore } from '@/stores/missionStore'
import { MISSION_DETAIL_REFRESH_MS, MISSION_ONBOARDING_AGENTS, MISSION_ONBOARDING_KANBAN_COLUMNS, MissionPanel, startMissionDetailAutoRefresh } from './MissionPanel'

afterEach(() => {
  vi.useRealTimers()
})

describe('MissionPanel onboarding placeholder data', () => {
  it('previews the required kanban and agent layout', () => {
    expect(MISSION_ONBOARDING_KANBAN_COLUMNS).toHaveLength(3)
    expect(MISSION_ONBOARDING_KANBAN_COLUMNS.map((column) => column.title)).toEqual([
      'To Claim',
      'In Progress',
      'Done',
    ])
    expect(MISSION_ONBOARDING_KANBAN_COLUMNS.every((column) => column.cards.length >= 2)).toBe(true)
    expect(MISSION_ONBOARDING_AGENTS.length).toBeGreaterThanOrEqual(2)
  })

  it('keeps Mission creation in the selector for the empty onboarding state', () => {
    useMissionStore.setState({
      missions: [],
      activeMission: null,
      selectedMission: null,
      isLoading: false,
      error: null,
    })

    const html = renderToStaticMarkup(createElement(MissionPanel))

    expect(html).toContain('No Missions')
    expect(html).toContain('New Mission')
    expect(html).not.toContain('Create Mission')
  })

  it('keeps onboarding preview styles inside narrow editor widths', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8')

    expect(css).toMatch(/\.mission-onboarding\s*{[^}]*overflow:\s*hidden;/s)
    expect(css).toMatch(/\.mission-onboarding-grid\s*{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s)
    expect(css).toMatch(/\.mission-onboarding-card\s*{[^}]*min-width:\s*0;/s)
    expect(css).toMatch(/\.mission-onboarding-card\s*(?:strong|p)[\s\S]*overflow-wrap:\s*anywhere;/)
  })

  it('places Mission Agents below Kanban in the active observation shell', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/missions/MissionPanel.tsx'), 'utf8')
    const kanbanIndex = source.indexOf('<MissionKanban')
    const agentsIndex = source.indexOf('<MissionAgents')

    expect(kanbanIndex).toBeGreaterThan(-1)
    expect(agentsIndex).toBeGreaterThan(kanbanIndex)
    expect(source).toContain("display: 'flex'")
    expect(source).toContain("flexDirection: 'column'")
    expect(source).not.toContain('gridTemplateColumns')
  })

  it('auto-refreshes selected Mission details on a 15 second visible interval and cleans up', async () => {
    vi.useFakeTimers()
    const loadMission = vi.fn<Parameters<typeof startMissionDetailAutoRefresh>[0]['loadMission']>().mockResolvedValue(undefined)
    let isHidden = false
    const stop = startMissionDetailAutoRefresh({
      missionName: 'hub-agent-team-mission-mvp',
      loadMission,
      getIsLoading: () => false,
      readDocumentHidden: () => isHidden,
    })

    await vi.advanceTimersByTimeAsync(MISSION_DETAIL_REFRESH_MS)
    expect(loadMission).toHaveBeenCalledWith('hub-agent-team-mission-mvp', { silent: true })

    isHidden = true
    await vi.advanceTimersByTimeAsync(MISSION_DETAIL_REFRESH_MS)
    expect(loadMission).toHaveBeenCalledTimes(1)

    isHidden = false
    await vi.advanceTimersByTimeAsync(MISSION_DETAIL_REFRESH_MS)
    expect(loadMission).toHaveBeenCalledTimes(2)

    stop()
    await vi.advanceTimersByTimeAsync(MISSION_DETAIL_REFRESH_MS)
    expect(loadMission).toHaveBeenCalledTimes(2)
  })
})
