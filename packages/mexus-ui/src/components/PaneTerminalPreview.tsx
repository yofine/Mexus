import type { MockPane } from '../mocks/types';

interface Props { pane: MockPane }

const MOCK_LINES: Record<string, string[]> = {
  running: [
    '> tsc --watch --noEmit',
    '✓ Compiled with 0 errors',
    'Watching for file changes…',
    '',
    'Squad Lead: routed task #c4e1f99 to Orion',
    'agent.activity files=7 age=12h41m',
  ],
  waiting: [
    '? Awaiting review on PR #214',
    '… 2 questions pending from Reviewer',
    '',
    'Last response 11 min ago',
  ],
  idle: [
    '◦ Pane idle',
    '◦ No active task — assign work to start',
  ],
  error: [
    '✗ Build failed: ENOENT src/missing.ts',
    'See /tmp/mexus-error-7f4.log',
  ],
};

export function PaneTerminalPreview({ pane }: Props) {
  const lines = MOCK_LINES[pane.status] ?? MOCK_LINES.idle;
  return (
    <div style={{
      background: '#0a0a0a',
      border: '1px solid var(--mx-border-subtle)',
      borderRadius: 'var(--mx-radius-md)',
      padding: '10px 12px',
      fontFamily: 'var(--mx-font-mono)',
      fontSize: 11,
      lineHeight: 1.65,
      color: 'var(--mx-text-secondary)',
      whiteSpace: 'pre',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        color: 'var(--mx-text-muted)',
        fontSize: 10,
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        marginBottom: 6,
      }}>
        <span>{pane.agent} · {pane.name}</span>
        <span>{pane.status}</span>
      </div>
      {lines.map((l, i) => (
        <div key={i} style={{
          color: l.startsWith('✓') ? 'var(--mx-status-running)'
            : l.startsWith('✗') ? 'var(--mx-status-error)'
            : l.startsWith('?') ? 'var(--mx-status-waiting)'
            : 'var(--mx-text-secondary)',
        }}>{l || '\u00a0'}</div>
      ))}
      <div style={{ color: 'var(--mx-accent)', marginTop: 4 }}>
        ›<span className="blink" style={{ marginLeft: 6 }} />
      </div>
    </div>
  );
}
