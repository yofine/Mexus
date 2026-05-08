import { describe, expect, it } from 'vitest'
import { parseMissionKanban, parseMissionRoundtable } from './missionParsers.ts'

const kanban = `# Agent Team Kanban

## To Claim

To: Samigina | From: Squad Lead | Scope: \`packages/server/src/mission/missionParsers.ts\`
- Ref: 7c8e4a1
- Request: Add parsers.
- Reason: Watchers need structured data.
- Acceptance: Parser tests pass.
- Question: Should this include approved roundtable items?
- Clarification: please confirm scope X
- Result:
- Files:
- Verification:
- Review:
- Updated: 2026-05-09, Samigina

## In Progress

No tasks claimed yet.

## Done

To: Bael | From: Squad Lead | Scope: \`packages/server/src/mission/MissionService.ts\`
- Ref: f0b6e39
- Request: Create a Squad Lead pane.
- Reason: New missions need a pane.
- Acceptance: Pane has mission metadata.
- Result: Done.
- Files: packages/server/src/mission/MissionService.ts
- Verification: pnpm test
- Review: accepted by: Squad Lead, 2026-05-06
- Updated: 2026-05-06, Squad Lead
`

const fullRoundtable = `# Roundtable

Mission: \`hub-agent-team-mission-mvp\`

## Pending Review

Ref: a2a-inbox
Topic: Mission Agent A2A inbox notification mechanism
Opened by: Squad Lead
Invitees: All
Scope: \`packages/server/src/mission/\`, pane PTY injection
- Question: How should we notify Mission Agents?
- Context: We need an A2A-style wakeup signal.
- Options: Option A, Option B
- Recommendation: Option A.
- Votes:
  - Bael: approve — backend scope is implementable.
  - Agares: approve — workspace-local state is correct.
  - Vassago: abstain — no UI objection.
  - Samigina: reject — parser needs splitting first.
  - Marbas: pending — pane mapping pending.
- Decision: Pending — needs majority.
- Follow-up: Dispatch parser and watcher tasks.
- Updated: 2026-05-09, Squad Lead

## Approved

No review items approved yet.

## Rejected

No review items rejected yet.
`

describe('mission parsers', () => {
  it('parses kanban tasks with clarification and question fields', () => {
    const parsed = parseMissionKanban(kanban)

    expect(parsed.ok).toBe(true)
    expect(parsed.tasks.toClaim[0]).toMatchObject({
      to: 'Samigina',
      from: 'Squad Lead',
      scope: 'packages/server/src/mission/missionParsers.ts',
      ref: '7c8e4a1',
      request: 'Add parsers.',
      question: 'Should this include approved roundtable items?',
      clarification: 'please confirm scope X',
      updated: '2026-05-09, Samigina',
    })
    expect(parsed.tasks.done[0]).toMatchObject({
      ref: 'f0b6e39',
      review: 'accepted by: Squad Lead, 2026-05-06',
    })
  })

  it('parses existing kanban tasks without clarification fields identically empty', () => {
    const parsed = parseMissionKanban(kanban)

    expect(parsed.ok).toBe(true)
    expect(parsed.tasks.done[0].question).toBeUndefined()
    expect(parsed.tasks.done[0].clarification).toBeUndefined()
  })

  it('returns raw fallback when kanban sections are malformed', () => {
    const parsed = parseMissionKanban('## To Claim\n\nTo: Missing | From: Done | Scope: x')

    expect(parsed).toEqual({
      ok: false,
      raw: '## To Claim\n\nTo: Missing | From: Done | Scope: x',
      error: 'Kanban sections To Claim, In Progress, and Done were not all found.',
      tasks: { toClaim: [], inProgress: [], done: [] },
    })
  })

  it('parses roundtable items with mixed vote states', () => {
    const parsed = parseMissionRoundtable(fullRoundtable)

    expect(parsed.ok).toBe(true)
    expect(parsed.items).toHaveLength(1)
    expect(parsed.items[0]).toMatchObject({
      ref: 'a2a-inbox',
      topic: 'Mission Agent A2A inbox notification mechanism',
      openedBy: 'Squad Lead',
      invitees: ['All'],
      scope: 'packages/server/src/mission/, pane PTY injection',
      decision: 'Pending — needs majority.',
      updated: '2026-05-09, Squad Lead',
      line: 6,
    })
    expect(parsed.items[0].votes).toEqual([
      { agent: 'Bael', vote: 'approve', reason: 'backend scope is implementable.' },
      { agent: 'Agares', vote: 'approve', reason: 'workspace-local state is correct.' },
      { agent: 'Vassago', vote: 'abstain', reason: 'no UI objection.' },
      { agent: 'Samigina', vote: 'reject', reason: 'parser needs splitting first.' },
      { agent: 'Marbas', vote: 'pending', reason: 'pane mapping pending.' },
    ])
  })

  it('parses roundtable items with optional decision and updated fields omitted', () => {
    const parsed = parseMissionRoundtable(`# Roundtable

## Pending Review

Ref: tiny
Topic: Small decision
Opened by: Bael
Invitees: Samigina, Squad Lead
Scope: parsers
- Votes:
  - Samigina: pending — needs parser check.
`)

    expect(parsed.ok).toBe(true)
    expect(parsed.items[0]).toMatchObject({
      ref: 'tiny',
      topic: 'Small decision',
      openedBy: 'Bael',
      invitees: ['Samigina', 'Squad Lead'],
      scope: 'parsers',
      decision: undefined,
      updated: undefined,
    })
  })

  it('returns raw fallback when roundtable review sections contain no Ref blocks', () => {
    const raw = '# Roundtable\n\n## Pending Review\n\nNo review items pending.\n'

    expect(parseMissionRoundtable(raw)).toEqual({
      ok: false,
      raw,
      error: 'No roundtable review item blocks found.',
      items: [],
    })
  })
})
