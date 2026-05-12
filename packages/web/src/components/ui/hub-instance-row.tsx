import * as React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from './badge'
import { StatusDot } from './status-dot'

export interface HubInstanceRowProps extends React.HTMLAttributes<HTMLDivElement> {
  name: React.ReactNode
  cwd?: React.ReactNode
  meta?: React.ReactNode
  port: number | string
  status: 'running' | 'stopped' | 'error'
  connected?: boolean
  actions?: React.ReactNode
}

export const HubInstanceRow = React.forwardRef<HTMLDivElement, HubInstanceRowProps>(
  ({ className, name, cwd, meta, port, status, connected = false, actions, ...props }, ref) => (
    <div ref={ref} className={cn('ui-hub-instance-row', connected && 'ui-hub-instance-row--connected', className)} {...props}>
      <StatusDot status={connected ? 'accent' : status === 'running' ? 'running' : 'error'} />
      <div className="ui-hub-instance-row__content">
        <div className="ui-hub-instance-row__top">
          <span className="ui-hub-instance-row__name">{name}</span>
          <Badge variant={connected ? 'accent' : status === 'running' ? 'success' : 'danger'}>:{port}</Badge>
        </div>
        {cwd && <div className="ui-hub-instance-row__cwd">{cwd}</div>}
        {meta && <div className="ui-hub-instance-row__meta">{meta}</div>}
      </div>
      {actions && <div className="ui-hub-instance-row__actions">{actions}</div>}
    </div>
  ),
)

HubInstanceRow.displayName = 'HubInstanceRow'
