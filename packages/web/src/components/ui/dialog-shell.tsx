import * as React from 'react'
import { cn } from '@/lib/utils'
import { IconButton } from './icon-button'

export interface DialogShellProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  onClose?: () => void
}

export const DialogShell = React.forwardRef<HTMLDivElement, DialogShellProps>(
  ({ className, title, description, footer, onClose, children, ...props }, ref) => (
    <div ref={ref} className={cn('ui-dialog-shell', className)} {...props}>
      <div className="ui-dialog-shell__header">
        <div className="ui-dialog-shell__heading">
          <div className="ui-dialog-shell__title">{title}</div>
          {description && <div className="ui-dialog-shell__description">{description}</div>}
        </div>
        {onClose && (
          <IconButton aria-label="Close dialog" size="sm" onClick={onClose}>
            ×
          </IconButton>
        )}
      </div>
      <div className="ui-dialog-shell__body">{children}</div>
      {footer && <div className="ui-dialog-shell__footer">{footer}</div>}
    </div>
  ),
)

DialogShell.displayName = 'DialogShell'
