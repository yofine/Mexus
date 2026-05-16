import { useEffect, useMemo, useState } from 'react'
import { loadAgentTeam, type AgentTeamPayload } from './agentTeamApi'
import { counts, parseKanban, type TaskStatus } from './kanbanParser'

const STATUSES: TaskStatus[] = ['To Claim', 'In Progress', 'Done']

function extractGoal(markdown: string) {
  return markdown.match(/## Mission Intent\n\n([\s\S]*?)(?:\n## |\z)/)?.[1]?.trim() || 'No mission intent recorded.'
}

function agentRows(markdown: string) {
  const table = markdown.match(/\| Agent Name \| Responsibility \|[\s\S]*?(?=\n## |\z)/)?.[0] || ''
  return table.split('\n')
    .filter((line) => line.startsWith('|') && !line.includes('---') && !line.includes('Agent Name'))
    .map((line) => line.split('|').map((part) => part.trim()).filter(Boolean))
    .filter((parts) => parts.length >= 2)
    .map(([name, responsibility]) => ({ name, responsibility }))
}

export function App() {
  const [payload, setPayload] = useState<AgentTeamPayload | null>(null)
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const tick = async () => {
      try {
        const next = await loadAgentTeam()
        if (!active) return
        setPayload(next)
        setError('')
        if (!selected && next.missions[0]) setSelected(next.missions[0].name)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err))
      }
    }
    tick()
    const id = window.setInterval(tick, 1500)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [selected])

  const mission = payload?.missions.find((item) => item.name === selected) || payload?.missions[0]
  const tasks = useMemo(() => parseKanban(mission?.kanban || ''), [mission?.kanban])
  const taskCounts = counts(tasks)
  const agents = useMemo(() => agentRows(mission?.agents || ''), [mission?.agents])

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1>Agent Team Board</h1>
          <p>{payload?.projectRoot || 'Waiting for project data'}</p>
        </div>
        <select value={mission?.name || ''} onChange={(event) => setSelected(event.target.value)}>
          {payload?.missions.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
        </select>
      </header>

      {error && <div className="notice">{error}</div>}
      {!mission ? (
        <div className="empty">No missions found.</div>
      ) : (
        <>
          <section className="overview">
            <div>
              <span>Mission</span>
              <strong>{mission.name}</strong>
            </div>
            <div>
              <span>To Claim</span>
              <strong>{taskCounts.toClaim}</strong>
            </div>
            <div>
              <span>In Progress</span>
              <strong>{taskCounts.inProgress}</strong>
            </div>
            <div>
              <span>Done</span>
              <strong>{taskCounts.done}</strong>
            </div>
          </section>

          <section className="goal">{extractGoal(mission.mission)}</section>

          <section className="kanban">
            {STATUSES.map((status) => {
              const columnTasks = tasks.filter((task) => task.status === status)
              return (
                <div className="column" key={status}>
                  <div className="column-title">
                    <span>{status}</span>
                    <span>{columnTasks.length}</span>
                  </div>
                  <div className="cards">
                    {columnTasks.length === 0 ? <div className="empty small">No tasks.</div> : columnTasks.map((task, index) => (
                      <article className="task" key={`${task.status}-${task.ref}-${index}`}>
                        <div className="task-top">
                          <strong>{task.ref || 'No ref'}</strong>
                          <span>{task.review ? 'reviewed' : 'pending'}</span>
                        </div>
                        <div className="task-meta">To {task.to} / From {task.from}</div>
                        <code>{task.scope}</code>
                        <p>{task.request}</p>
                        <footer>{task.updated || 'No update'}</footer>
                      </article>
                    ))}
                  </div>
                </div>
              )
            })}
          </section>

          <section className="agents">
            {agents.map((agent) => (
              <article key={agent.name}>
                <strong>{agent.name}</strong>
                <p>{agent.responsibility}</p>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  )
}
