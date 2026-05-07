import { AlertTriangle, CircleDot, ClipboardList, Clock3 } from 'lucide-react'
import type { MissionKanbanParseResult, MissionOverview as MissionOverviewData, MissionSummary } from '@/stores/missionStore'

function lifecycleColor(lifecycle?: string): string {
  if (lifecycle === 'active') return 'var(--accent-primary)'
  if (lifecycle === 'completed') return '#3FB950'
  if (lifecycle === 'inactive') return 'var(--text-secondary)'
  return '#F0883E'
}

export function MissionOverview({ mission, overview, kanban }: {
  mission: MissionSummary
  overview: MissionOverviewData | null
  kanban: MissionKanbanParseResult | null
}) {
  const lifecycle = overview?.lifecycle || mission.lifecycle || (mission.incomplete ? 'incomplete' : 'unknown')

  return (
    <section style={{
      borderBottom: '1px solid var(--border-subtle)',
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <CircleDot className="icon-sm" style={{ color: lifecycleColor(lifecycle), flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <h2 style={{
              margin: 0,
              color: 'var(--text-primary)',
              fontSize: 'var(--font-lg)',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {overview?.name || mission.name}
            </h2>
            <span style={{
              color: lifecycleColor(lifecycle),
              border: `1px solid ${lifecycleColor(lifecycle)}`,
              borderRadius: 'var(--radius-sm)',
              padding: '1px 6px',
              fontSize: 'var(--font-xs)',
              textTransform: 'capitalize',
              flexShrink: 0,
            }}>
              {lifecycle}
            </span>
          </div>
          {(overview?.date || mission.date || mission.createdAt) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', fontSize: 'var(--font-xs)', marginTop: 3 }}>
              <Clock3 className="icon-xs" />
              <span>{overview?.date || mission.date || mission.createdAt}</span>
            </div>
          )}
        </div>
      </div>

      {overview?.intent && (
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', lineHeight: 1.45 }}>
          {overview.intent}
        </p>
      )}

      {mission.incomplete && (
        <div style={{ display: 'flex', gap: 8, color: '#F0883E', fontSize: 'var(--font-xs)', lineHeight: 1.45 }}>
          <AlertTriangle className="icon-xs" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>Mission files are incomplete{mission.missingFiles?.length ? `: ${mission.missingFiles.join(', ')}` : ''}</span>
        </div>
      )}

      {!kanban?.ok && kanban?.error && (
        <div style={{ display: 'flex', gap: 8, color: 'var(--text-muted)', fontSize: 'var(--font-xs)', lineHeight: 1.45 }}>
          <ClipboardList className="icon-xs" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{kanban.error}</span>
        </div>
      )}
    </section>
  )
}
