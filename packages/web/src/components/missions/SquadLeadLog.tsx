import { ExternalLink, NotebookText } from 'lucide-react'
import type { SquadLeadLogParseResult } from '@/stores/missionStore'

interface SquadLeadLogProps {
  log: SquadLeadLogParseResult | null
  onOpenSource?: (file: string, line?: number) => void
}

export function SquadLeadLog({ log, onOpenSource }: SquadLeadLogProps) {
  if (!log) {
    return (
      <section className="mission-panel mission-squad-log">
        <div className="mission-empty">No Squad Lead work log loaded.</div>
      </section>
    )
  }

  if (!log.ok) {
    return (
      <section className="mission-panel mission-squad-log">
        <div className="mission-panel-header">
          <div>
            <h3>Squad Lead Work Log</h3>
            <p>Parser fallback</p>
          </div>
          {onOpenSource && (
            <button className="pane-action-btn" title="Open squad-lead.md" onClick={() => onOpenSource('squad-lead.md')}>
              <ExternalLink className="icon-xs" />
            </button>
          )}
        </div>
        <div className="mission-warning">{log.error || 'Unable to parse squad-lead.md.'}</div>
        <pre className="mission-raw-fallback">{log.raw}</pre>
      </section>
    )
  }

  return (
    <section className="mission-panel mission-squad-log">
      <div className="mission-panel-header">
        <div>
          <h3>Squad Lead Work Log</h3>
          <p>{log.entries.length} entries from squad-lead.md</p>
        </div>
        {onOpenSource ? (
          <button className="pane-action-btn" title="Open squad-lead.md" onClick={() => onOpenSource('squad-lead.md')}>
            <ExternalLink className="icon-xs" />
          </button>
        ) : (
          <NotebookText className="icon-sm" style={{ color: 'var(--text-muted)' }} />
        )}
      </div>

      <div className="mission-squad-log-list">
        {log.entries.map((entry) => (
          <article className="mission-squad-log-entry" key={entry.id}>
            <div className="mission-squad-log-date">
              <span>{entry.date || '-'}</span>
              <span>{entry.actor || 'Squad Lead'}</span>
            </div>
            <p>{entry.detail}</p>
            {onOpenSource && (
              <button className="mission-squad-log-link" onClick={() => onOpenSource('squad-lead.md', entry.line)}>
                line {entry.line}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
