// Mirrors packages/web/src/components/AgentIcon.tsx — same agents, same palette.
// Loads SVGs from /assets/<agent>.svg (the site copies them into public/assets).

const AGENT_ICON_SRC: Record<string, string> = {
  claudecode: '/assets/claude.svg',
  claude: '/assets/claude.svg',
  codex: '/assets/codex.svg',
  opencode: '/assets/opencode.svg',
  gemini: '/assets/gemini.svg',
};

const AGENT_DISPLAY: Record<string, string> = {
  claudecode: 'Claude Code',
  claude: 'Claude Code',
  codex: 'Codex',
  opencode: 'OpenCode',
  'kimi-cli': 'Kimi Code',
  kimi: 'Kimi Code',
  qodercli: 'Qoder CLI',
  qoder: 'Qoder CLI',
  gemini: 'Gemini',
  aider: 'Aider',
  cursor: 'Cursor',
};

export function getAgentDisplayName(agent: string): string {
  return AGENT_DISPLAY[agent.toLowerCase()] || agent;
}

export function AgentIcon({ agent, size = 16, assetsBase = '/assets' }: {
  agent: string;
  size?: number;
  assetsBase?: string;
}) {
  const key = agent.toLowerCase();
  const rel = AGENT_ICON_SRC[key];
  if (rel) {
    const src = assetsBase + rel.replace(/^\/assets/, '');
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        style={{ width: size, height: size, flexShrink: 0, display: 'block', objectFit: 'contain' }}
      />
    );
  }
  const initial = (AGENT_DISPLAY[key] || agent).slice(0, 1).toUpperCase();
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, flexShrink: 0,
        display: 'inline-grid', placeItems: 'center',
        color: 'var(--mx-text-muted)',
        fontFamily: 'var(--mx-font-mono)',
        fontSize: 10, fontWeight: 700, lineHeight: 1,
      }}
    >
      {initial}
    </span>
  );
}
