import * as React from 'react'
import { cn } from '@/lib/utils'

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode
  description?: React.ReactNode
  error?: React.ReactNode
}

export const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ className, label, description, error, children, ...props }, ref) => (
    <div ref={ref} className={cn('ui-field', error && 'ui-field--error', className)} {...props}>
      <div className="ui-field__label">{label}</div>
      {description && <div className="ui-field__description">{description}</div>}
      <div className="ui-field__control">{children}</div>
      {error && <div className="ui-field__error">{error}</div>}
    </div>
  ),
)

Field.displayName = 'Field'

export interface FormRowProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode
  value?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}

export const FormRow = React.forwardRef<HTMLDivElement, FormRowProps>(
  ({ className, label, value, description, actions, children, ...props }, ref) => (
    <div ref={ref} className={cn('ui-form-row', className)} {...props}>
      <div className="ui-form-row__main">
        <div className="ui-form-row__label">{label}</div>
        {description && <div className="ui-form-row__description">{description}</div>}
      </div>
      {value && <div className="ui-form-row__value">{value}</div>}
      {children && <div className="ui-form-row__control">{children}</div>}
      {actions && <div className="ui-form-row__actions">{actions}</div>}
    </div>
  ),
)

FormRow.displayName = 'FormRow'

