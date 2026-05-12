import * as React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from './badge'

export interface MissionAgentRowProps extends React.HTMLAttributes<HTMLDivElement> {
  name: React.ReactNode
  responsibility?: React.ReactNode
  meta?: React.ReactNode
}

export const MissionAgentRow = React.forwardRef<HTMLDivElement, MissionAgentRowProps>(
  ({ className, name, responsibility, meta, ...props }, ref) => (
    <div ref={ref} className={cn('ui-mission-agent-row', className)} {...props}>
      <div className="ui-mission-agent-row__avatar" aria-hidden="true">{String(name).slice(0, 1).toUpperCase()}</div>
      <div className="ui-mission-agent-row__content">
        <div className="ui-mission-agent-row__name">{name}</div>
        {responsibility && <div className="ui-mission-agent-row__responsibility">{responsibility}</div>}
      </div>
      {meta && <div className="ui-mission-agent-row__meta">{meta}</div>}
    </div>
  ),
)

MissionAgentRow.displayName = 'MissionAgentRow'

export interface TaskCardProps extends React.HTMLAttributes<HTMLElement> {
  refId?: React.ReactNode
  to?: React.ReactNode
  from?: React.ReactNode
  status: 'To Claim' | 'In Progress' | 'Done'
  scope?: React.ReactNode
  request?: React.ReactNode
  updated?: React.ReactNode
  reviewed?: boolean
  actions?: React.ReactNode
}

function taskStatusClass(status: TaskCardProps['status']) {
  return status.toLowerCase().replace(/\s+/g, '-')
}

export const TaskCard = React.forwardRef<HTMLElement, TaskCardProps>(
  ({ className, refId, to, from, status, scope, request, updated, reviewed, actions, ...props }, ref) => (
    <article ref={ref} className={cn('ui-task-card', `ui-task-card--${taskStatusClass(status)}`, className)} {...props}>
      <div className="ui-task-card__top">
        <strong>{refId || 'No ref'}</strong>
        <Badge variant={reviewed ? 'success' : 'neutral'}>{reviewed ? 'reviewed' : status}</Badge>
      </div>
      {(to || from) && <div className="ui-task-card__assignment">To {to || 'n/a'} / From {from || 'n/a'}</div>}
      {scope && <div className="ui-task-card__scope">{scope}</div>}
      {request && <p className="ui-task-card__request">{request}</p>}
      <div className="ui-task-card__footer">
        {updated && <span>{updated}</span>}
        {actions}
      </div>
    </article>
  ),
)

TaskCard.displayName = 'TaskCard'

