import * as React from 'react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, actions, ...props }, ref) => (
    <div ref={ref} className={cn('ui-empty-state', className)} {...props}>
      {icon && <div className="ui-empty-state__icon">{icon}</div>}
      <div className="ui-empty-state__title">{title}</div>
      {description && <div className="ui-empty-state__description">{description}</div>}
      {actions && <div className="ui-empty-state__actions">{actions}</div>}
    </div>
  ),
)

EmptyState.displayName = 'EmptyState'
