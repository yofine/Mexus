import * as React from 'react'
import { cn } from '@/lib/utils'

export interface LoadingStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode
  description?: React.ReactNode
}

export const LoadingState = React.forwardRef<HTMLDivElement, LoadingStateProps>(
  ({ className, title = 'Loading', description, ...props }, ref) => (
    <div ref={ref} className={cn('ui-loading-state', className)} aria-live="polite" {...props}>
      <span className="ui-loading-state__spinner" aria-hidden="true" />
      <div className="ui-loading-state__title">{title}</div>
      {description && <div className="ui-loading-state__description">{description}</div>}
    </div>
  ),
)

LoadingState.displayName = 'LoadingState'
