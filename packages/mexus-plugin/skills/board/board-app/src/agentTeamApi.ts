export interface AgentTeamMissionPayload {
  name: string
  mission: string
  agents: string
  kanban: string
  roundtable: string
  squadLead: string
}

export interface AgentTeamPayload {
  projectRoot: string
  workflow: string
  roster: string
  missions: AgentTeamMissionPayload[]
}

export async function loadAgentTeam(): Promise<AgentTeamPayload> {
  const url = import.meta.env.VITE_AGENT_TEAM_API_URL || '/api/agent-team'
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to load Agent Team data: ${response.status}`)
  return response.json()
}
