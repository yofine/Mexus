import { useState, useEffect } from 'react'
import { GitBranch, Share2, Zap, X, MessageSquare } from 'lucide-react'
import { AgentIcon, getAgentDisplayName } from './AgentIcon'
import type { MissionAgentObservation } from '@/stores/missionStore'
import type { ClientEvent, AgentType, IsolationMode, AgentAvailability, PaneMission } from '@/types'
import { loadLayoutPreferences } from '@/lib/layoutPreferences'
import { api } from '@/lib/apiBase'

const AGENT_TYPES: AgentType[] = ['claudecode', 'codex', 'opencode', 'kimi-cli', 'qodercli']

function estimateTerminalDimensions(): { cols: number; rows: number } {
  const FONT_SIZE = 13
  const FONT_FAMILY = "'Geist Mono', 'JetBrains Mono', monospace"
  const LINE_HEIGHT = Math.ceil(FONT_SIZE * 1.2)
  const XTERM_PADDING = 18
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  let charWidth = FONT_SIZE * 0.6
  if (ctx) {
    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`
    charWidth = ctx.measureText('W').width
  }
  let containerWidth = 480 - 18
  try {
    const prefs = loadLayoutPreferences()
    containerWidth = prefs.widthsByMode[prefs.mode].agents - XTERM_PADDING
  } catch { /* ignore */ }
  const termHeight = Math.min(800, Math.max(300, window.innerHeight * 0.6)) - 40
  const cols = Math.max(40, Math.floor(containerWidth / charWidth))
  const rows = Math.max(10, Math.floor(termHeight / LINE_HEIGHT))
  return { cols, rows }
}

function missionPathForDetails(mission: { name: string; path?: string }): string {
  return mission.path || `agent-team/missions/${mission.name}`
}

function missionAgentTask(missionName: string, missionPath: string, agent: MissionAgentObservation): string {
  const lines = [
    `You are ${agent.name}, a Mission Agent for mission \`${missionName}\`.`,
    '',
    'Read:',
    '- agent-team/mission-workflow.md',
    '- agent-team/agents.md',
    `- ${missionPath}/mission.md`,
    `- ${missionPath}/agents.md`,
    `- ${missionPath}/kanban.md`,
    `- ${missionPath}/roundtable.md`,
    '',
    `Responsibility: ${agent.responsibility || 'See the mission agents file.'}`,
    '',
    'Claim one task assigned to you in kanban.md, work within its scope, fill Result/Files/Verification, move it to Done, then check for more assigned tasks or tasks you published that need Review.',
  ]

  if (agent.activationPromptSummary) {
    lines.push('', 'Activation prompt summary:', agent.activationPromptSummary)
  }
  if (agent.initialPromptSummary) {
    lines.push('', 'Initial prompt summary:', agent.initialPromptSummary)
  }

  return lines.join('\n')
}

export function buildMissionAgentPaneDefaults(
  mission: { name: string; path?: string },
  agent: MissionAgentObservation,
): { name: string; task: string } {
  return {
    name: `${agent.name} - ${mission.name}`,
    task: missionAgentTask(mission.name, missionPathForDetails(mission), agent),
  }
}

export function buildPaneMission(
  mission: { name: string; path?: string } | null | undefined,
  agent: MissionAgentObservation | null | undefined,
): PaneMission | undefined {
  if (!mission || !agent) return undefined
  return {
    name: mission.name,
    path: missionPathForDetails(mission),
    role: 'mission-agent',
    agentName: agent.name,
  }
}

interface AddPaneDialogProps {
  isOpen: boolean
  onClose: () => void
  send: (event: ClientEvent) => void
}

export function AddPaneDialog({ isOpen, onClose, send }: AddPaneDialogProps) {
  const [name, setName] = useState('')
  const [agent, setAgent] = useState<AgentType>('claudecode')
  const [task, setTask] = useState('')
  const [isolation, setIsolation] = useState<IsolationMode>('shared')
  const [yolo, setYolo] = useState(false)
  const [agentAvailability, setAgentAvailability] = useState<Record<string, AgentAvailability> | null>(null)
  const [agentChangedByUser, setAgentChangedByUser] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    fetch(api('/api/agents'))
      .then(res => res.json())
      .then(data => {
        setAgentAvailability(data)
        const firstInstalled = AGENT_TYPES.find(a => data[a]?.installed)
        if (firstInstalled && (!data[agent] || !data[agent].installed)) {
          setAgent(firstInstalled)
        }
      })
      .catch(() => {})
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const estimatedDims = estimateTerminalDimensions()

    send({
      type: 'pane.create',
      config: {
        name: name.trim(),
        agent,
        task: task.trim() || undefined,
        restore: 'restart',
        isolation,
        yolo: yolo || undefined,
        ...estimatedDims,
      },
    })

    setName('')
    setTask('')
    setIsolation('shared')
    setYolo(false)
    setAgentChangedByUser(false)
    onClose()
  }

  const isAgentInstalled = (a: AgentType) => !agentAvailability || agentAvailability[a]?.installed === true
  const visibleAgentTypes = agentAvailability ? AGENT_TYPES.filter((a) => isAgentInstalled(a)) : AGENT_TYPES

  const handleAgentSelect = (nextAgent: AgentType) => {
    setAgentChangedByUser(true)
    setAgent(nextAgent)
  }

  return (
    <div className="dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="add-pane-dialog">
        {/* Header */}
        <div className="apd-header">
          <h2 className="apd-title">New Agent Pane</h2>
          <button type="button" onClick={onClose} className="apd-close-btn">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="apd-form">
          {/* Agent type selector — prominent, top-level */}
          <div className="apd-section">
            <label className="apd-label">Agent</label>
            <div className="apd-agent-grid">
              {visibleAgentTypes.map((a) => {
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => handleAgentSelect(a)}
                    title={getAgentDisplayName(a)}
                    className={`apd-agent-card${agent === a ? ' apd-agent-card--active' : ''}`}
                  >
                    <AgentIcon agent={a} size="24px" className="apd-agent-icon" />
                  </button>
                )
              })}
              {visibleAgentTypes.length === 0 && (
                <div className="apd-agent-empty">No configured agents available.</div>
              )}
            </div>
          </div>

          {/* Name input */}
          <div className="apd-section">
            <label className="apd-label" htmlFor="apd-name">Name</label>
            <input
              id="apd-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Auth Refactor"
              required
              className="apd-input"
              autoFocus
            />
          </div>

          <div className="apd-section">
            <label className="apd-label" htmlFor="apd-task">
              <MessageSquare size={12} />
              Task
              <span className="apd-label-hint">optional</span>
            </label>
            <textarea
              id="apd-task"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe what this agent should work on..."
              rows={5}
              className="apd-input apd-textarea"
            />
          </div>

          {/* Options row */}
          <div className="apd-options">
            <div className="apd-option-group">
              <button
                type="button"
                onClick={() => setIsolation(isolation === 'shared' ? 'worktree' : 'shared')}
                className={`apd-option-chip${isolation === 'worktree' ? ' apd-option-chip--active' : ''}`}
              >
                {isolation === 'worktree' ? <GitBranch size={13} /> : <Share2 size={13} />}
                {isolation === 'worktree' ? 'Worktree' : 'Shared'}
              </button>

              <button
                type="button"
                onClick={() => setYolo(!yolo)}
                className={`apd-option-chip${yolo ? ' apd-option-chip--warning' : ''}`}
                aria-pressed={yolo}
              >
                <Zap size={13} />
                YOLO {yolo ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Footer actions */}
          <div className="apd-footer">
            <button type="button" onClick={onClose} className="btn btn--secondary">
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!name.trim() || visibleAgentTypes.length === 0}
            >
              Create Pane
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
