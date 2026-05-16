import type { MockActivityCard } from '../mocks/types';
import { Icon, PaneAvatar } from './primitives';

const TABS = ['Activity', 'Team', 'Review', 'Replay'] as const;
const SUBTABS = ['Agent', 'Modules', 'Imports', 'Conflicts', 'Files'] as const;

const TAB_ICONS: Record<typeof TABS[number], 'activity' | 'team' | 'review' | 'replay'> = {
  Activity: 'activity', Team: 'team', Review: 'review', Replay: 'replay',
};

interface Props {
  cards: MockActivityCard[];
  /** Find the agent for an activity card by matching id against a pane list. */
  panes?: { id: string; agent: string }[];
  assetsBase?: string;
}

export function ActivityPanel({ cards, panes = [], assetsBase }: Props) {
  const agentFor = (id: string) => panes.find((p) => p.id === id)?.agent ?? 'claude';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--mx-bg-base)' }}>
      <div className="mx-tabs">
        {TABS.map((tab) => (
          <span key={tab} className={`mx-tab ${tab === 'Activity' ? 'mx-tab--active' : ''}`}>
            <Icon name={TAB_ICONS[tab]} size={12} />
            {tab}
          </span>
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ display: 'inline-grid', placeItems: 'center', padding: '0 12px', color: 'var(--mx-text-muted)' }}>
          <Icon name="maximize" size={13} />
        </span>
      </div>

      <div className="mx-subtabs">
        {SUBTABS.map((s, i) => (
          <span key={s} className={`mx-subtab ${i === 0 ? 'mx-subtab--active' : ''}`}>
            {i === 0 && <Icon name="team" size={10} strokeWidth={2} />}
            {s}
          </span>
        ))}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 12,
        padding: 14,
        overflow: 'auto',
      }}>
        {cards.map((c) => (
          <div key={c.id} className={`mx-card ${c.status === 'Running' ? 'mx-card--running' : ''}`}>
            <div className="mx-card__head">
              <div className="mx-card__title">
                <PaneAvatar hue={c.hue} agent={agentFor(c.id)} size={22} assetsBase={assetsBase} />
                <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{c.name}</span>
              </div>
              <span className={`mx-pill ${c.status === 'Running' ? 'mx-pill--running' : c.status === 'Waiting' ? 'mx-pill--waiting' : 'mx-pill--idle'}`}>
                {c.status}
              </span>
            </div>
            <div className="mx-card__meta">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="file" size={11} strokeWidth={1.6} />
                {c.files} files
              </span>
              <span>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="replay" size={11} strokeWidth={1.6} />
                {c.age}
              </span>
            </div>
            <div className="mx-card__duration">{c.duration}</div>
          </div>
        ))}
      </div>

      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid var(--mx-border-subtle)',
        background: 'var(--mx-bg-base)',
      }}>
        <div style={{
          fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase',
          color: 'var(--mx-text-muted)', marginBottom: 4,
          fontFamily: 'var(--mx-font-mono)',
        }}>
          Timeline
        </div>
        <div className="mx-mono" style={{ fontSize: 11.5, color: 'var(--mx-text-muted)' }}>
          No activity yet
        </div>
      </div>
    </div>
  );
}
