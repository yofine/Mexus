import type { AgentDefinition, PaneConfig } from '../types.ts'

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function buildInitialPrompt(config: PaneConfig): string | null {
  const parts: string[] = []
  if (config.workdir) {
    parts.push(`Modification boundary: ${config.workdir}`)
  }
  if (config.task) {
    parts.push(`Task:\n${config.task}`)
  }
  return parts.length > 0 ? parts.join('\n\n') : null
}

export function buildAgentCommand(config: PaneConfig, agentDef: AgentDefinition): string {
  const args: string[] = [agentDef.bin]
  if (agentDef.default_args?.length) {
    args.push(...agentDef.default_args)
  }

  if (config.restore === 'resume') {
    if (!config.sessionId) {
      throw new Error(`Cannot resume ${config.agent}: missing session id`)
    }
    if (agentDef.resume_command) {
      args.push(agentDef.resume_command, config.sessionId)
    } else if (agentDef.resume_flag) {
      args.push(agentDef.resume_flag, config.sessionId)
    } else {
      throw new Error(`Agent ${config.agent} does not define resume support`)
    }
  } else if (config.restore === 'continue' && agentDef.continue_flag) {
    args.push(agentDef.continue_flag)
  }

  if (config.yolo && agentDef.yolo_flag) {
    args.push(agentDef.yolo_flag)
  }

  const initialPrompt = (config.restore !== 'manual' && config.restore !== 'resume')
    ? buildInitialPrompt(config)
    : null
  if (initialPrompt) {
    args.push(initialPrompt)
  }

  return args.map(shellQuote).join(' ')
}
