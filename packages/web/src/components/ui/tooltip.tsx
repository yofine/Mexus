import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TooltipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'content'> {
  content: React.ReactNode
}

export function Tooltip({ className, content, children, ...props }: TooltipProps) {
  return (
    <span className={cn('ui-tooltip', className)} {...props}>
      {children}
      <span role="tooltip" className="ui-tooltip__content">
        {content}
      </span>
    </span>
  )
}
