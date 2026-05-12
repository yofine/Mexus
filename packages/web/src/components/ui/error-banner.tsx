import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ErrorBannerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode
  message: React.ReactNode
  actions?: React.ReactNode
}

export const ErrorBanner = React.forwardRef<HTMLDivElement, ErrorBannerProps>(
  ({ className, title, message, actions, ...props }, ref) => (
    <div ref={ref} role="alert" className={cn('ui-error-banner', className)} {...props}>
      <div className="ui-error-banner__content">
        {title && <div className="ui-error-banner__title">{title}</div>}
        <div className="ui-error-banner__message">{message}</div>
      </div>
      {actions && <div className="ui-error-banner__actions">{actions}</div>}
    </div>
  ),
)

ErrorBanner.displayName = 'ErrorBanner'
