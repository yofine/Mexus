import * as React from 'react'
import { cn } from '@/lib/utils'
import { StatusDot } from './status-dot'

export interface SectionHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}

export const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ className, title, description, actions, ...props }, ref) => (
    <div ref={ref} className={cn('ui-section-header', className)} {...props}>
      <div className="ui-section-header__content">
        <div className="ui-section-header__title">{title}</div>
        {description && <div className="ui-section-header__description">{description}</div>}
      </div>
      {actions && <div className="ui-section-header__actions">{actions}</div>}
    </div>
  ),
)

SectionHeader.displayName = 'SectionHeader'

export interface CompactCardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title: React.ReactNode
  description?: React.ReactNode
  meta?: React.ReactNode
  actions?: React.ReactNode
}

export const CompactCard = React.forwardRef<HTMLElement, CompactCardProps>(
  ({ className, title, description, meta, actions, ...props }, ref) => (
    <article ref={ref} className={cn('ui-compact-card', className)} {...props}>
      <div className="ui-compact-card__content">
        <div className="ui-compact-card__title">{title}</div>
        {description && <div className="ui-compact-card__description">{description}</div>}
        {meta && <div className="ui-compact-card__meta">{meta}</div>}
      </div>
      {actions && <div className="ui-compact-card__actions">{actions}</div>}
    </article>
  ),
)

CompactCard.displayName = 'CompactCard'

export interface EntityRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode
  meta?: React.ReactNode
  status?: 'running' | 'waiting' | 'idle' | 'error' | 'accent'
  leading?: React.ReactNode
  actions?: React.ReactNode
}

export const EntityRow = React.forwardRef<HTMLDivElement, EntityRowProps>(
  ({ className, title, meta, status = 'idle', leading, actions, ...props }, ref) => (
    <div ref={ref} className={cn('ui-entity-row', className)} {...props}>
      {leading || <StatusDot status={status} />}
      <div className="ui-entity-row__content">
        <div className="ui-entity-row__title">{title}</div>
        {meta && <div className="ui-entity-row__meta">{meta}</div>}
      </div>
      {actions && <div className="ui-entity-row__actions">{actions}</div>}
    </div>
  ),
)

EntityRow.displayName = 'EntityRow'
