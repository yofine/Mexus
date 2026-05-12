import * as React from 'react'
import { cn } from '@/lib/utils'

type StatusDotStatus = 'running' | 'waiting' | 'idle' | 'error' | 'accent'

export interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: StatusDotStatus
  label?: string
}

export const StatusDot = React.forwardRef<HTMLSpanElement, StatusDotProps>(
  ({ className, status = 'idle', label, ...props }, ref) => (
    <span
      ref={ref}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('ui-status-dot', `ui-status-dot--${status}`, className)}
      {...props}
    />
  ),
)

StatusDot.displayName = 'StatusDot'

