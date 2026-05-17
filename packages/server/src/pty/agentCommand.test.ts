import { describe, expect, it } from 'vitest'
import type { AgentDefinition, PaneConfig } from '../types.ts'
import { buildAgentCommand } from './agentCommand.ts'

const baseConfig: PaneConfig = {
  id: 'pane-1',
  name: 'Worker',
  agent: 'claudecode',
  restore: 'restart',
  isolation: 'shared',
  yolo: false,
}

const baseAgent: AgentDefinition = {
  bin: 'claude',
  continue_flag: '--continue',
  resume_flag: '--resume',
  yolo_flag: '--dangerously-skip-permissions',
  statusline: true,
}

describe('buildAgentCommand', () => {
  it('includes a configured resume flag and session id', () => {
    expect(buildAgentCommand({ ...baseConfig, restore: 'resume', sessionId: 'sess-1' }, baseAgent))
      .toBe('claude --resume sess-1')
  })

  it('does not append task/workdir prompt when resuming', () => {
    expect(buildAgentCommand({
      ...baseConfig,
      restore: 'resume',
      sessionId: 'sess-1',
      workdir: 'src/auth',
      task: 'Refactor JWT validation',
    }, baseAgent)).toBe('claude --resume sess-1')
  })

  it('passes workdir as a modification boundary in the initial agent prompt', () => {
    expect(buildAgentCommand({
      ...baseConfig,
      workdir: 'src/auth',
      task: 'Refactor JWT validation',
    }, baseAgent)).toBe("claude 'Modification boundary: src/auth\n\nTask:\nRefactor JWT validation'")
  })

  it('uses a configured resume command subcommand', () => {
    expect(buildAgentCommand(
      { ...baseConfig, agent: 'codex', restore: 'resume', sessionId: 'sess-2' },
      { ...baseAgent, bin: 'codex', continue_flag: '', resume_command: 'resume', resume_flag: '' },
    )).toBe('codex resume sess-2')
  })

  it('adds configured default args before restore and prompt args', () => {
    expect(buildAgentCommand(
      {
        ...baseConfig,
        agent: 'codex',
        restore: 'restart',
        task: 'Render all numbered lines',
      },
      {
        ...baseAgent,
        bin: 'codex',
        default_args: ['--no-alt-screen'],
        continue_flag: '',
        resume_command: 'resume',
        resume_flag: '',
      },
    )).toBe("codex --no-alt-screen 'Task:\nRender all numbered lines'")
  })

  it('throws when resume is requested for an agent without resume support', () => {
    expect(() => buildAgentCommand(
      { ...baseConfig, restore: 'resume', sessionId: 'sess-3' },
      { ...baseAgent, resume_flag: '', resume_command: '' },
    )).toThrow('does not define resume support')
  })
})
