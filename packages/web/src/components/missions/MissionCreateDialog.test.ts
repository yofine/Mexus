import { describe, expect, it } from 'vitest'
import { buildMissionCreatePayload, validateMissionCreateInput } from './MissionCreateDialog'

describe('MissionCreateDialog helpers', () => {
  it('rejects empty or invalid mission names before submission', () => {
    expect(validateMissionCreateInput({ name: '   ' })).toEqual({ name: 'Mission name is required.' })
    expect(validateMissionCreateInput({ name: '../escape' })).toEqual({ name: 'Use letters, numbers, dots, underscores, or hyphens. Start with a letter or number.' })
    expect(validateMissionCreateInput({ name: 'bad/name' })).toEqual({ name: 'Use letters, numbers, dots, underscores, or hyphens. Start with a letter or number.' })
    expect(validateMissionCreateInput({ name: '-bad' })).toEqual({ name: 'Use letters, numbers, dots, underscores, or hyphens. Start with a letter or number.' })
  })

  it('builds a trimmed payload with every Mission creation field', () => {
    expect(buildMissionCreatePayload({
      name: '  mission-alpha  ',
      goal: '  Goal text  ',
      constraints: '  Constraint text  ',
      acceptance: '  Acceptance text  ',
    })).toEqual({
      name: 'mission-alpha',
      goal: 'Goal text',
      constraints: 'Constraint text',
      acceptance: 'Acceptance text',
    })
  })
})
