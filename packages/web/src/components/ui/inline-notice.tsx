import * as React from 'react'
import { cn } from '@/lib/utils'

type InlineNoticeVariant = 'neutral' | 'accent' | 'warning' | 'danger' | 'success'

export interface InlineNoticeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: InlineNoticeVariant
}

export const InlineNotice = React.forwardRef<HTMLDivElement, InlineNoticeProps>(
  ({ className, variant = 'neutral', ...props }, ref) => (
    <div ref={ref} className={cn('ui-inline-notice', `ui-inline-notice--${variant}`, className)} {...props} />
  ),
)

InlineNotice.displayName = 'InlineNotice'

