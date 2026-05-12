import * as React from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'neutral', ...props }, ref) => (
    <span ref={ref} className={cn('ui-badge', `ui-badge--${variant}`, className)} {...props} />
  ),
)

Badge.displayName = 'Badge'

