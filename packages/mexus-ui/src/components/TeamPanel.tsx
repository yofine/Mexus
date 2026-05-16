import type { MockKanbanCol } from '../mocks/types';
import { ChevronDown, Icon } from './primitives';

const TABS = ['Activity', 'Team', 'Review', 'Replay'] as const;
const SUBTABS = ['Kanban', 'Mission Agents', 'Squad Lead Log'] as const;
const TAB_ICONS = { Activity: 'activity', Team: 'team', Review: 'review', Replay: 'replay' } as const;

interface Props {
  kanban: MockKanbanCol[];
  missionName?: string;
  missionDate?: string;
  missionDescription?: string;
}

export function TeamPanel({
  kanban,
  missionName = 'checkout-revamp-v2',
  missionDate = '2026-05-12',
  missionDescription = 'Reskin the storefront checkout, swap address validation, and add the new mailer queue.',
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--mx-bg-base)' }}>
      <div className="mx-tabs">
        {TABS.map((tab) => (
          <span key={tab} className={`mx-tab ${tab === 'Team' ? 'mx-tab--active' : ''}`}>
            <Icon name={TAB_ICONS[tab]} size={12} />
            {tab}
          </span>
        ))}
        <span style={{ flex: 1 }} />
      </div>

      {/* mission selector */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', borderRadius: 4,
          border: '1px solid var(--mx-border-default)',
          background: 'var(--mx-bg-elevated)',
          fontFamily: 'var(--mx-font-mono)', fontSize: 12,
        }}>
          <span className="mx-text-primary" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {missionName}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--mx-text-muted)' }}>
            <span style={{
              fontFamily: 'var(--mx-font-mono)', fontSize: 10, fontWeight: 700,
              letterSpacing: '.08em', color: 'var(--mx-status-running)',
            }}>ACTIVE</span>
            <ChevronDown size={11} />
          </span>
        </div>
      </div>

      <div style={{ padding: '0 14px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--mx-text-primary)' }}>{missionName}</span>
          <span className="mx-pill mx-pill--running">Active</span>
        </div>
        <div style={{
          fontFamily: 'var(--mx-font-mono)', fontSize: 11.5,
          color: 'var(--mx-text-muted)', marginTop: 3,
        }}>
          {missionDate}
        </div>
        <p style={{
          marginTop: 8,
          fontSize: 12.5,
          color: 'var(--mx-text-secondary)',
          lineHeight: 1.55,
        }}>
          {missionDescription}
        </p>
      </div>

      <div className="mx-subtabs" style={{ padding: '6px 14px' }}>
        {SUBTABS.map((s, i) => (
          <span key={s} className={`mx-subtab ${i === 0 ? 'mx-subtab--active' : ''}`}>{s}</span>
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
            <div key={col.name} className="mx-kanban-col">
              <div className="mx-kanban-col__head">
                <span className="mx-text-primary">{col.name}</span>
                <span className="mx-text-muted">{col.count}</span>
              </div>
              {col.cards.length === 0 ? (
                <div className="mx-kanban-empty">No matching tasks.</div>
              ) : (
                col.cards.map((c) => (
                  <div key={c.id} className="mx-kanban-card">
                    <div className="mx-kanban-card__id">
                      <span>{c.id}</span>
                      <Icon name="open" size={11} strokeWidth={1.6} />
                    </div>
                    {c.assignTo && (
                      <span className="mx-kanban-card__tag">
                        To {c.assignTo} / From {c.assignFrom}
                      </span>
                    )}
                    <div className="mx-kanban-card__body">{c.title}</div>
                  </div>
                ))
              )}
            </div>
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
