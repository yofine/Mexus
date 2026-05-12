import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { DialogShell } from './dialog-shell'

export interface ConfirmDialogProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode
  description?: React.ReactNode
  confirmLabel: React.ReactNode
  cancelLabel: React.ReactNode
  danger?: boolean
  onConfirm?: () => void
  onCancel?: () => void
}

export const ConfirmDialog = React.forwardRef<HTMLDivElement, ConfirmDialogProps>(
  ({ className, title, description, confirmLabel, cancelLabel, danger = true, onConfirm, onCancel, ...props }, ref) => (
    <DialogShell
      ref={ref}
      className={cn('ui-confirm-dialog', className)}
      title={title}
      description={description}
      footer={(
        <>
          <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      )}
      {...props}
    />
  ),
)

ConfirmDialog.displayName = 'ConfirmDialog'

