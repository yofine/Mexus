import type { CSSProperties } from 'react'

interface AgentIconProps {
  agent: string
  size?: number | string
  className?: string
}

const AGENT_ICON_SRC: Record<string, string> = {
  claudecode: '/assets/claude.svg',
  claude: '/assets/claude.svg',
  codex: '/assets/codex.svg',
  opencode: '/assets/opencode.svg',
  gemini: '/assets/gemini.svg',
}

export function getAgentIconSrc(agent: string): string | null {
  return AGENT_ICON_SRC[agent.toLowerCase()] || null
}

export function AgentIcon({ agent, size = 16, className }: AgentIconProps) {
  const normalized = agent.toLowerCase()
  const sizeStyle: CSSProperties = {
    width: size,
    height: size,
    flexShrink: 0,
  }
  const iconSrc = getAgentIconSrc(normalized)

  if (iconSrc) {
    return (
      <img
        src={iconSrc}
        alt=""
        aria-hidden="true"
        className={className}
        style={{ ...sizeStyle, display: 'block', objectFit: 'contain' }}
      />
    )
  }

  const initial = getAgentDisplayName(normalized).slice(0, 1).toUpperCase()
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        ...sizeStyle,
        display: 'inline-grid',
        placeItems: 'center',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {initial}
    </span>
  )
}

// Agent display name mapping
export function getAgentDisplayName(agent: string): string {
  const map: Record<string, string> = {
    claudecode: 'Claude Code',
    claude: 'Claude Code',
    codex: 'Codex',
    opencode: 'OpenCode',
    'kimi-cli': 'Kimi Code',
    kimi: 'Kimi Code',
    kimicode: 'Kimi Code',
    qodercli: 'Qoder CLI',
    qoder: 'Qoder CLI',
    openai: 'OpenAI',
    gemini: 'Gemini',
    aider: 'Aider',
    cursor: 'Cursor',
  }
  return map[agent.toLowerCase()] || agent
}

// Agent brand color
export function getAgentColor(agent: string): string {
  const map: Record<string, string> = {
    claudecode: '#D97757',
    claude: '#D97757',
    codex: '#10A37F',
    opencode: '#58A6FF',
    'kimi-cli': '#6366F1',
    kimi: '#6366F1',
    qodercli: '#0EA5E9',
    qoder: '#0EA5E9',
    openai: '#10A37F',
    gemini: '#8B5CF6',
    aider: '#22C55E',
    cursor: '#F59E0B',
    workspace: '#888888',
  }
  return map[agent.toLowerCase()] || 'var(--accent-primary)'
}

// Per-pane instance colors — visually distinct palette for differentiating agents
const PANE_COLORS = [
  '#7C6AF7', // purple
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#8B5CF6', // violet
  '#14B8A6', // teal
  '#84CC16', // lime
  '#E879F9', // fuchsia
]

export function getPaneColor(index: number): string {
  return PANE_COLORS[index % PANE_COLORS.length]
}

// Get pane color by paneId, looking up index in panes array
export function getPaneColorById(paneId: string, panes: Array<{ id: string }>): string {
  const index = panes.findIndex((p) => p.id === paneId)
  return getPaneColor(index >= 0 ? index : 0)
}
