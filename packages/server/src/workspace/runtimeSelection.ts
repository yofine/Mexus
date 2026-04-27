import type { AgentDefinition, AgentTransport, AgentType } from '../types.ts'

export function resolveAgentRuntime(_agentType: AgentType, _agentDef?: AgentDefinition): AgentTransport {
  return 'pty'
}
