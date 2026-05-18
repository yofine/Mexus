import type { MockActivityCard } from '../mocks/types';
import { Icon } from './primitives';
import { ActivityCard, SubtabPill, Tab } from './atoms';
import type { IconName } from './primitives';

const TABS = ['Activity', 'Team', 'Review', 'Replay'] as const;
const SUBTABS = ['Agent', 'Modules', 'Imports', 'Conflicts', 'Files'] as const;

const TAB_ICONS: Record<typeof TABS[number], IconName> = {
  Activity: 'activity', Team: 'team', Review: 'review', Replay: 'replay',
};

const SUBTAB_ICONS: Record<typeof SUBTABS[number], IconName | undefined> = {
  Agent: 'team', Modules: undefined, Imports: undefined, Conflicts: undefined, Files: 'file',
};

interface Props {
  cards: MockActivityCard[];
  panes?: { id: string; agent: string }[];
  assetsBase?: string;
  activeTab?: typeof TABS[number];
  activeSubtab?: typeof SUBTABS[number];
  onTabChange?: (tab: typeof TABS[number]) => void;
  onSubtabChange?: (sub: typeof SUBTABS[number]) => void;
  onCardClick?: (id: string) => void;
}

export function ActivityPanel({
  cards,
  panes = [],
  assetsBase,
  activeTab = 'Activity',
  activeSubtab = 'Agent',
  onTabChange,
  onSubtabChange,
  onCardClick,
}: Props) {
  const agentFor = (id: string) => panes.find((p) => p.id === id)?.agent ?? 'claude';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--mx-bg-base)' }}>
      <div className="mx-tabs">
        {TABS.map((tab) => (
          <Tab
            key={tab}
            icon={TAB_ICONS[tab]}
            label={tab}
            active={tab === activeTab}
            onClick={() => onTabChange?.(tab)}
          />
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ display: 'inline-grid', placeItems: 'center', padding: '0 12px', color: 'var(--mx-text-muted)' }}>
          <Icon name="maximize" size={13} />
        </span>
      </div>

      <div className="mx-subtabs">
        {SUBTABS.map((s) => (
          <SubtabPill
            key={s}
            icon={SUBTAB_ICONS[s]}
            label={s}
            active={s === activeSubtab}
            onClick={() => onSubtabChange?.(s)}
          />
        ))}
      </div>

      {activeSubtab === 'Agent' ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 12,
          padding: 14,
          overflow: 'auto',
        }}>
          {cards.map((c) => (
            <ActivityCard
              key={c.id}
              card={c}
              agent={agentFor(c.id)}
              assetsBase={assetsBase}
              onClick={onCardClick ? () => onCardClick(c.id) : undefined}
            />
          ))}
        </div>
      ) : (
        <SubtabEmpty subtab={activeSubtab} count={cards.length} />
      )}

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

function SubtabEmpty({ subtab, count }: { subtab: string; count: number }) {
  const hints: Record<string, string> = {
    Modules: 'Module map for active panes — coming online.',
    Imports: 'Import graph view — coming online.',
    Conflicts: 'No conflicts detected across active panes.',
    Files: `Files touched by the ${count} active agent run${count === 1 ? '' : 's'} will land here.`,
  };
  return (
    <div style={{
      padding: '48px 24px',
      color: 'var(--mx-text-muted)',
      fontFamily: 'var(--mx-font-mono)',
      fontSize: 12,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 14, color: 'var(--mx-text-primary)', marginBottom: 8 }}>{subtab}</div>
      {hints[subtab] ?? 'Section content coming online.'}
    </div>
  );
}
