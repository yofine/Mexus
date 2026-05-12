import * as React from 'react'
import { cn } from '@/lib/utils'

export interface HubInstanceCardProps extends React.HTMLAttributes<HTMLElement> {
  name: React.ReactNode
  cwd: React.ReactNode
  port: number | string
  status: 'running' | 'stopped' | 'error'
  meta?: React.ReactNode
  actions?: React.ReactNode
}

export const HubInstanceCard = React.forwardRef<HTMLElement, HubInstanceCardProps>(
  ({ className, name, cwd, port, status, meta, actions, ...props }, ref) => (
    <article
      ref={ref}
      className={cn('ui-hub-instance-card', className)}
      {...props}
    >
      <div className="ui-hub-instance-card__body">
        <header className="ui-hub-instance-card__top">
          <div className="ui-hub-instance-card__identity">
            <h3 className="ui-hub-instance-card__name">{name}</h3>
          </div>
          <div className="ui-hub-instance-card__state">
            <span className="ui-hub-instance-card__port">:{port}</span>
            <span className={cn('ui-hub-instance-card__status', `ui-hub-instance-card__status--${status}`)}>
              {status}
            </span>
          </div>
        </header>

        <div className="ui-hub-instance-card__content">
          <div className="ui-hub-instance-card__cwd" title={typeof cwd === 'string' ? cwd : undefined}>
            {cwd}
          </div>

          {meta && <div className="ui-hub-instance-card__meta">{meta}</div>}
        </div>

        {actions && <div className="ui-hub-instance-card__actions">{actions}</div>}
      </div>
    </article>
  ),
)

HubInstanceCard.displayName = 'HubInstanceCard'
