import { useEffect, useMemo, useState } from 'react'
import { loadAgentTeam, type AgentTeamPayload } from './agentTeamApi'
import { parseKanban, type TaskStatus } from './kanbanParser'

const STATUSES: TaskStatus[] = ['To Claim', 'In Progress', 'Done']
const TABS = ['Mission Plan', 'Kanban', 'Agents', 'SquadLead Log', 'RoundTable'] as const
type Tab = typeof TABS[number]
interface AgentCard {
  name: string
  summary: string
  responsibility: string
  modules: string[]
}
interface MarkdownSection {
  title: string
  body: string
}
interface RoundtableReview {
  status: string
  ref: string
  topic: string
  openedBy: string
  invitees: string
  scope: string
  question: string
  context: string
  options: string
  recommendation: string
  votes: string
  decision: string
  followUp: string
  updated: string
}

function extractGoal(markdown: string) {
  return markdown.match(/## Mission Intent\n\n([\s\S]*?)(?:\n## |$)/)?.[1]?.trim() || 'No mission intent recorded.'
}

function markdownSections(markdown: string): MarkdownSection[] {
  const sections = [...markdown.matchAll(/^## (.+)\n\n([\s\S]*?)(?=\n## |$)/gm)]
    .map((match) => ({ title: match[1].trim(), body: match[2].trim() }))
    .filter((section) => section.body)

  if (sections.length > 0) return sections
  return markdown.trim() ? [{ title: 'Details', body: markdown.trim() }] : []
}

function missionPlanSections(markdown: string) {
  return markdownSections(markdown)
}

function agentRows(markdown: string): AgentCard[] {
  const table = markdown.match(/\| Agent Name \| Responsibility \|[\s\S]*?(?=\n## |$)/)?.[0] || ''
  const rows = table.split('\n')
    .filter((line) => line.startsWith('|') && !line.includes('---') && !line.includes('Agent Name'))
    .map((line) => line.split('|').map((part) => part.trim()).filter(Boolean))
    .filter((parts) => parts.length >= 2)
    .map(([name, responsibility]) => ({ name: name.replace(/`/g, ''), responsibility }))

  return rows.map((row) => {
    const escaped = row.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const section = markdown.match(new RegExp(`## Agent: ${escaped}\\n\\n([\\s\\S]*?)(?=\\n## Agent: |$)`))?.[1] || ''
    const responsibility = section.match(/^Responsibility:\s*([\s\S]*?)(?:\n\n|$)/m)?.[1]?.trim() || row.responsibility
    const modulesBlock =
      section.match(/^(?:Modules|Responsible modules|Files|Scope):\s*([\s\S]*?)(?:\n\n|$)/m)?.[1]?.trim() || ''
    const modules = modulesBlock
      .split('\n')
      .map((line) => line.replace(/^[-*]\s+/, '').trim())
      .filter(Boolean)

    return {
      name: row.name,
      summary: row.responsibility,
      responsibility,
      modules,
    }
  })
}

function field(markdown: string, label: string) {
  return markdown.match(new RegExp(`^${label}:\\s*(.*)$`, 'm'))?.[1]?.trim() || ''
}

function squadLeadEntries(markdown: string) {
  return markdown
    .split('\n')
    .filter((line) => /^[-*]\s+/.test(line.trim()) || /^\d+\.\s+/.test(line.trim()))
    .map((line) => line.replace(/^[-*]\s+|^\d+\.\s+/, '').trim())
    .filter(Boolean)
}

function avatarLabel(name: string) {
  return name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'AG'
}

function sectionBody(markdown: string, heading: string) {
  const marker = `## ${heading}`
  const start = markdown.indexOf(marker)
  if (start === -1) return ''
  const bodyStart = start + marker.length
  const next = markdown.indexOf('\n## ', bodyStart)
  return markdown.slice(bodyStart, next === -1 ? markdown.length : next).trim()
}

function reviewField(block: string, label: string) {
  const prefix = `${label}:`
  const dashedPrefix = `- ${label}:`
  for (const line of block.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith(dashedPrefix)) return trimmed.slice(dashedPrefix.length).trim()
    if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length).trim()
  }
  return ''
}

function roundtableReviews(markdown: string): RoundtableReview[] {
  const statuses = ['Pending Review', 'Approved', 'Rejected']
  const reviews: RoundtableReview[] = []

  const pushBlocks = (status: string, blocks: string[]) => {
    for (const block of blocks) {
      const value = (label: string) => reviewField(block, label)
      reviews.push({
        status,
        ref: value('Ref') || 'no-ref',
        topic: value('Topic') || 'Untitled proposal',
        openedBy: value('Opened by') || 'unknown',
        invitees: value('Invitees') || 'unknown',
        scope: value('Scope') || 'not specified',
        question: value('Question'),
        context: value('Context'),
        options: value('Options'),
        recommendation: value('Recommendation'),
        votes: value('Votes'),
        decision: value('Decision'),
        followUp: value('Follow-up'),
        updated: value('Updated'),
      })
    }
  }

  for (const status of statuses) {
    const body = sectionBody(markdown, status)
    if (!body || /^No reviews/i.test(body) || /^No review items/i.test(body)) continue
    pushBlocks(status, body.split(/(?=^Ref:\s)/m).filter((block) => block.startsWith('Ref:')))
  }

  if (reviews.length === 0) {
    pushBlocks('Review', markdown.split(/(?=^Ref:\s)/m).filter((block) => block.startsWith('Ref:')))
  }

  return reviews
}

export function App() {
  const [payload, setPayload] = useState<AgentTeamPayload | null>(null)
  const [selected, setSelected] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('Kanban')
  const [selectedReview, setSelectedReview] = useState(0)
  const [helpOpen, setHelpOpen] = useState(false)
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

  const missions = useMemo(() => [...(payload?.missions || [])].sort((a, b) => {
    const lifecycleA = field(a.mission, 'Lifecycle')
    const lifecycleB = field(b.mission, 'Lifecycle')
    if (lifecycleA === 'active' && lifecycleB !== 'active') return -1
    if (lifecycleB === 'active' && lifecycleA !== 'active') return 1
    return field(b.mission, 'Created at').localeCompare(field(a.mission, 'Created at')) || a.name.localeCompare(b.name)
  }), [payload?.missions])
  const mission = missions.find((item) => item.name === selected) || missions[0]
  const tasks = useMemo(() => parseKanban(mission?.kanban || ''), [mission?.kanban])
  const agents = useMemo(() => agentRows(mission?.agents || ''), [mission?.agents])
  const leadEntries = useMemo(() => squadLeadEntries(mission?.squadLead || ''), [mission?.squadLead])
  const planSections = useMemo(() => missionPlanSections(mission?.mission || ''), [mission?.mission])
  const reviews = useMemo(() => roundtableReviews(mission?.roundtable || ''), [mission?.roundtable])
  const activeReview = reviews[Math.min(selectedReview, Math.max(reviews.length - 1, 0))]
  const roundtableRaw = mission?.roundtable.trim() || ''

  return (
    <main className="shell">
      <header className="topbar">
        <div className="title-block">
          <img src="/favicon.svg" alt="" aria-hidden="true" />
          <h1>Mexus Team Board</h1>
        </div>
        <nav className="mission-tabs" aria-label="Missions">
          {missions.map((item) => (
            <button
              key={item.name}
              type="button"
              className={item.name === mission?.name ? 'active' : ''}
              onClick={() => setSelected(item.name)}
            >
              {item.name}
            </button>
          ))}
        </nav>
        <button type="button" className="help-button" onClick={() => setHelpOpen(true)}>
          Help
        </button>
      </header>

      {error && <div className="notice">{error}</div>}
      {!mission ? (
        <div className="empty">No missions found.</div>
      ) : (
        <>
          <section className="mission-stack">
            <article className="module mission-module">
              <div className="module-head">
                <div>
                  <span>Mission</span>
                  <strong>{mission.name}</strong>
                </div>
              </div>
              <div className="mission-meta">
                <div>
                  <span>Lifecycle</span>
                  <strong>{field(mission.mission, 'Lifecycle') || 'unknown'}</strong>
                </div>
                <div>
                  <span>Execution</span>
                  <strong>{field(mission.mission, 'Execution mode') || 'unknown'}</strong>
                </div>
                <div>
                  <span>Created</span>
                  <strong>{field(mission.mission, 'Created at') || 'unknown'}</strong>
                </div>
              </div>
              <p>{extractGoal(mission.mission)}</p>
            </article>
          </section>

          <nav className="tabs" aria-label="Agent Team views">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={tab === activeTab ? 'active' : ''}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </nav>

          {activeTab === 'Kanban' && (
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
          )}

          {activeTab === 'Agents' && (
            <section className="agents">
              {agents.map((agent) => (
                <article key={agent.name}>
                  <div className="agent-head">
                    <div className="agent-avatar" aria-hidden="true">{avatarLabel(agent.name)}</div>
                    <div>
                      <strong>{agent.name}</strong>
                      <span>{agent.summary}</span>
                    </div>
                  </div>
                  <div className="agent-block">
                    <span>Responsibility</span>
                    <p>{agent.responsibility}</p>
                  </div>
                  <div className="agent-block">
                    <span>Files / Modules</span>
                    {agent.modules.length === 0 ? (
                      <code>not specified</code>
                    ) : (
                      <div className="agent-modules">
                        {agent.modules.map((module) => <code key={module}>{module}</code>)}
                      </div>
                    )}
                  </div>
                  <div className="agent-stats">
                    <div>
                      <span>To Claim</span>
                      <strong>{tasks.filter((task) => task.to === agent.name && task.status === 'To Claim').length}</strong>
                    </div>
                    <div>
                      <span>In Progress</span>
                      <strong>{tasks.filter((task) => task.to === agent.name && task.status === 'In Progress').length}</strong>
                    </div>
                    <div>
                      <span>Done</span>
                      <strong>{tasks.filter((task) => task.to === agent.name && task.status === 'Done').length}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}

          {activeTab === 'SquadLead Log' && (
            <section className="lead-log">
              {leadEntries.length === 0 ? <div className="empty small">No SquadLead log entries.</div> : leadEntries.map((entry, index) => (
                <article key={`${entry}-${index}`}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{entry}</p>
                </article>
              ))}
            </section>
          )}

          {activeTab === 'RoundTable' && (
            <section className="roundtable">
              <aside className="roundtable-list" aria-label="RoundTable proposals">
                {reviews.length === 0 && !roundtableRaw ? (
                  <div className="empty small">No roundtable proposals.</div>
                ) : reviews.length === 0 ? (
                  <button type="button" className="active">
                    <span>Raw</span>
                    <strong>RoundTable Markdown</strong>
                    <code>unparsed</code>
                  </button>
                ) : reviews.map((review, index) => (
                  <button
                    key={`${review.ref}-${index}`}
                    type="button"
                    className={index === selectedReview ? 'active' : ''}
                    onClick={() => setSelectedReview(index)}
                  >
                    <span>{review.status}</span>
                    <strong>{review.topic}</strong>
                    <code>{review.ref}</code>
                  </button>
                ))}
              </aside>

              <article className="roundtable-detail">
                {!activeReview && roundtableRaw ? (
                  <section className="roundtable-field">
                    <span>Raw RoundTable</span>
                    <p>{roundtableRaw}</p>
                  </section>
                ) : !activeReview ? (
                  <div className="empty small">Select a proposal to review.</div>
                ) : (
                  <>
                    <div className="roundtable-detail-head">
                      <div>
                        <span>{activeReview.status}</span>
                        <strong>{activeReview.topic}</strong>
                      </div>
                      <code>{activeReview.ref}</code>
                    </div>
                    <div className="roundtable-meta">
                      <div><span>Opened by</span><strong>{activeReview.openedBy}</strong></div>
                      <div><span>Invitees</span><strong>{activeReview.invitees}</strong></div>
                      <div><span>Scope</span><strong>{activeReview.scope}</strong></div>
                    </div>
                    {[
                      ['Question', activeReview.question],
                      ['Context', activeReview.context],
                      ['Options', activeReview.options],
                      ['Recommendation', activeReview.recommendation],
                      ['Votes', activeReview.votes],
                      ['Decision', activeReview.decision],
                      ['Follow-up', activeReview.followUp],
                      ['Updated', activeReview.updated],
                    ].filter(([, value]) => value).map(([label, value]) => (
                      <section className="roundtable-field" key={label}>
                        <span>{label}</span>
                        <p>{value}</p>
                      </section>
                    ))}
                  </>
                )}
              </article>
            </section>
          )}

          {activeTab === 'Mission Plan' && (
            <section className="mission-plan-view">
              {planSections.map((section) => (
                <article key={section.title}>
                  <strong>{section.title}</strong>
                  <pre>{section.body}</pre>
                </article>
              ))}
            </section>
          )}
        </>
      )}

      {helpOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setHelpOpen(false)}>
          <section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>Plugin Help</span>
                <h2 id="help-title">Mexus Agent Team Commands</h2>
              </div>
              <button type="button" onClick={() => setHelpOpen(false)} aria-label="Close help">Close</button>
            </header>

            <div className="help-grid">
              <article>
                <strong>Commands</strong>
                <dl>
                  <dt><code>/mexus-skill:team "&lt;request&gt;"</code></dt>
                  <dd>Create a new active Mission, archive the previous active Mission, and plan Agents plus kanban tasks.</dd>
                  <dt><code>/mexus-skill:run</code></dt>
                  <dd>Execute the latest active Mission by starting background Agents from the kanban.</dd>
                  <dt><code>/mexus-skill:roundtable "&lt;topic&gt;"</code></dt>
                  <dd>Open a Pending Review proposal for a shared decision in the active Mission.</dd>
                  <dt><code>/mexus-skill:board</code></dt>
                  <dd>Open this read-only local Web board for Mission observation.</dd>
                  <dt><code>/mexus-skill:team-status</code></dt>
                  <dd>Print Mission, task, and Agent status in the terminal.</dd>
                  <dt><code>/mexus-skill:team-stop</code></dt>
                  <dd>Stop the local board process without deleting Mission files.</dd>
                </dl>
              </article>

              <article>
                <strong>Workflow</strong>
                <div className="help-flow" aria-label="Agent Team workflow">
                  <div><span>1</span><p><code>/team</code><br />Create active Mission</p></div>
                  <div><span>2</span><p>Squad Lead<br />plans Agents + Kanban</p></div>
                  <div><span>3</span><p><code>/board</code><br />Observe Mission state</p></div>
                  <div><span>4</span><p><code>/run</code><br />Start background Agents</p></div>
                  <div><span>5</span><p>Agents claim,<br />execute, self-test</p></div>
                  <div><span>6</span><p>Publisher reviews;<br />Squad Lead accepts</p></div>
                </div>
              </article>

              <article>
                <strong>Operating Rules</strong>
                <ul>
                  <li><code>Squad Lead</code> is a fixed coordination role, not an execution Agent name.</li>
                  <li>Kanban task <code>From</code> is always Squad Lead or an executing Agent, never User.</li>
                  <li>Execution Agents update their own task blocks. Squad Lead does not write their results.</li>
                  <li>If ownership is unclear, publish a clarification task to Squad Lead.</li>
                  <li>RoundTable records shared decisions and does not directly move kanban state.</li>
                </ul>
              </article>

              <article>
                <strong>Files</strong>
                <ul>
                  <li><code>agent-team/agents.md</code>: repository-level reusable Agent roster.</li>
                  <li><code>agent-team/missions/&lt;name&gt;/mission.md</code>: Mission goal and plan.</li>
                  <li><code>agents.md</code>: Mission squad and prompts.</li>
                  <li><code>kanban.md</code>: task source of truth.</li>
                  <li><code>roundtable.md</code>: proposal and review record.</li>
                </ul>
              </article>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
