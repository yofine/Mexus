import { describe, expect, it } from 'vitest'
import type { AgentDefinition } from '../types.ts'
import { resolveAgentRuntime } from './runtimeSelection.ts'

describe('resolveAgentRuntime', () => {
  it('uses pty for shell panes', () => {
    expect(resolveAgentRuntime('__shell__')).toBe('pty')
  })

  it('ignores acp transport while acp mode is disabled', () => {
    const def: AgentDefinition = {
      bin: 'opencode',
      continue_flag: '--continue',
      statusline: false,
      transport: 'acp',
    }

    expect(resolveAgentRuntime('opencode', def)).toBe('pty')
  })
})
