import type { MockKanbanCard, MockKanbanCol } from '../mocks/types';
import type { IconName } from './primitives';
import { KanbanColumn, MissionHeader, MissionSelector, SubtabPill, Tab } from './atoms';

const TABS = ['Activity', 'Team', 'Review', 'Replay'] as const;
const SUBTABS = ['Kanban', 'Mission Agents', 'Squad Lead Log'] as const;
const TAB_ICONS: Record<typeof TABS[number], IconName> = {
  Activity: 'activity', Team: 'team', Review: 'review', Replay: 'replay',
};

interface Props {
  kanban: MockKanbanCol[];
  missionName?: string;
  missionDate?: string;
  missionDescription?: string;
  activeTab?: typeof TABS[number];
  activeSubtab?: typeof SUBTABS[number];
  onTabChange?: (tab: typeof TABS[number]) => void;
  onSubtabChange?: (sub: typeof SUBTABS[number]) => void;
  onCardClick?: (card: MockKanbanCard) => void;
  onMissionSelectorClick?: () => void;
}

export function TeamPanel({
  kanban,
  missionName = 'checkout-revamp-v2',
  missionDate = '2026-05-12',
  missionDescription = 'Reskin the storefront checkout, swap address validation, and add the new mailer queue.',
  activeTab = 'Team',
  activeSubtab = 'Kanban',
  onTabChange,
  onSubtabChange,
  onCardClick,
  onMissionSelectorClick,
}: Props) {
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
      </div>

      <div style={{ padding: '12px 14px' }}>
        <MissionSelector name={missionName} onClick={onMissionSelectorClick} />
      </div>

      <div style={{ padding: '0 14px 12px' }}>
        <MissionHeader name={missionName} date={missionDate} description={missionDescription} />
      </div>

      <div className="mx-subtabs" style={{ padding: '6px 14px' }}>
        {SUBTABS.map((s) => (
          <SubtabPill key={s} label={s} active={s === activeSubtab} onClick={() => onSubtabChange?.(s)} />
        ))}
      </div>

      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 13, marginBottom: 4 }}>
          <span className="mx-text-primary" style={{ fontWeight: 600 }}>Kanban</span>
        </div>
        <div style={{
          fontFamily: 'var(--mx-font-mono)', fontSize: 11.5,
          color: 'var(--mx-text-muted)', marginBottom: 10,
        }}>
          {summariseKanban(kanban)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          {kanban.map((col) => (
            <KanbanColumn key={col.name} column={col} onCardClick={onCardClick} />
          ))}
        </div>
      </div>
    </div>
  );
}

function summariseKanban(cols: MockKanbanCol[]): string {
  const part = (name: 'To Claim' | 'In Progress' | 'Done', label: string) => {
    const col = cols.find((c) => c.name === name);
    const done = col?.count.split('/')[0] ?? '0';
    return `${done} ${label}`;
  };
  return `${part('To Claim', 'to claim')} / ${part('In Progress', 'in progress')} / ${part('Done', 'done')}`;
}
