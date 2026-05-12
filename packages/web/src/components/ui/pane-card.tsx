import * as React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from './badge'
import { StatusDot } from './status-dot'

type PaneStatus = 'running' | 'waiting' | 'idle' | 'stopped' | 'error'

export interface PaneCardProps extends React.HTMLAttributes<HTMLElement> {
  name: React.ReactNode
  agent: React.ReactNode
  status: PaneStatus
  color?: string
  task?: React.ReactNode
  meta?: React.ReactNode[]
  actions?: React.ReactNode
}

export const PaneCard = React.forwardRef<HTMLElement, PaneCardProps>(
  ({ className, name, agent, status, color, task, meta = [], actions, style, ...props }, ref) => (
    <article
      ref={ref}
      className={cn('ui-pane-card', `ui-pane-card--${status}`, className)}
      style={{ ...style, ['--pane-color' as string]: color }}
      {...props}
    >
      <div className="ui-pane-card__stripe" aria-hidden="true" />
      <div className="ui-pane-card__body">
        <div className="ui-pane-card__top">
          <div className="ui-pane-card__title">{name}</div>
          <Badge variant={status === 'error' ? 'danger' : status === 'running' ? 'success' : status === 'waiting' ? 'warning' : 'neutral'}>
            {status}
          </Badge>
        </div>
        <div className="ui-pane-card__agent">{agent}</div>
        {task && <div className="ui-pane-card__task">{task}</div>}
        {meta.length > 0 && <div className="ui-pane-card__meta">{meta.map((item, index) => <span key={index}>{item}</span>)}</div>}
      </div>
      {actions && <div className="ui-pane-card__actions">{actions}</div>}
    </article>
  ),
)

PaneCard.displayName = 'PaneCard'

export interface PaneStackRowProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'name'> {
  name: React.ReactNode
  agent: React.ReactNode
  status: PaneStatus
  color?: string
  description?: React.ReactNode
  meta?: React.ReactNode[]
}

export const PaneStackRow = React.forwardRef<HTMLButtonElement, PaneStackRowProps>(
  ({ className, name, agent, status, color, description, meta = [], style, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn('ui-pane-stack-row', `ui-pane-stack-row--${status}`, className)}
      style={{ ...style, ['--pane-color' as string]: color }}
      {...props}
    >
      <StatusDot status={status === 'stopped' ? 'idle' : status} />
      <span className="ui-pane-stack-row__name">{name}</span>
      <span className="ui-pane-stack-row__agent">{agent}</span>
      {meta.map((item, index) => <span key={index} className="ui-pane-stack-row__meta">{item}</span>)}
      {description && <span className="ui-pane-stack-row__description">{description}</span>}
    </button>
  ),
)

PaneStackRow.displayName = 'PaneStackRow'
