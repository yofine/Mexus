import { Users } from 'lucide-react'
import type { MissionAgentsParseResult } from '@/stores/missionStore'

interface MissionAgentsProps {
  agents: MissionAgentsParseResult | null
}

export function MissionAgents({ agents }: MissionAgentsProps) {
  if (!agents) {
    return (
      <section className="mission-panel mission-agents">
        <div className="mission-empty">No Mission Agent data loaded.</div>
      </section>
    )
  }

  if (!agents.ok) {
    return (
      <section className="mission-panel mission-agents">
        <div className="mission-panel-header">
          <div>
            <h3>Mission Agents</h3>
            <p>Parser fallback</p>
          </div>
        </div>
        <div className="mission-warning">{agents.error || 'Unable to parse agents.md.'}</div>
        <pre className="mission-raw-fallback">{agents.raw}</pre>
      </section>
    )
  }

  return (
    <section className="mission-panel mission-agents">
      <div className="mission-panel-header">
        <div>
          <h3>Mission Agents</h3>
          <p>{agents.agents.length} assigned</p>
        </div>
        <Users className="icon-sm" style={{ color: 'var(--text-muted)' }} />
      </div>
      <div className="mission-agent-list">
        {agents.agents.map((agent) => (
          <article className="mission-agent-card" key={agent.name}>
            <div className="mission-agent-card-head">
              <div className="mission-agent-avatar" aria-hidden="true">
                {agent.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="mission-agent-card-top">
                <div>
                  <strong>{agent.name}</strong>
                  <span>Mission Agent</span>
                </div>
                <span>{agent.taskCounts.total} tasks</span>
              </div>
            </div>
            <div className="mission-agent-profile">
              <p>{agent.responsibility || 'No responsibility recorded.'}</p>
              <div className="mission-agent-counts">
                <span>{agent.taskCounts.toClaim} to claim</span>
                <span>{agent.taskCounts.inProgress} active</span>
                <span>{agent.taskCounts.done} done</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
