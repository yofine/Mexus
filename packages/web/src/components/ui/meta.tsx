import * as React from 'react'
import { cn } from '@/lib/utils'

export interface MetaRowProps extends React.HTMLAttributes<HTMLDivElement> {}

export const MetaRow = React.forwardRef<HTMLDivElement, MetaRowProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('ui-meta-row', className)} {...props} />
  ),
)

MetaRow.displayName = 'MetaRow'

export interface KeyValueMetaProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: React.ReactNode
  value: React.ReactNode
}

export const KeyValueMeta = React.forwardRef<HTMLSpanElement, KeyValueMetaProps>(
  ({ className, label, value, ...props }, ref) => (
    <span ref={ref} className={cn('ui-key-value-meta', className)} {...props}>
      <span className="ui-key-value-meta__label">{label}</span>
      <span className="ui-key-value-meta__value">{value}</span>
    </span>
  ),
)

KeyValueMeta.displayName = 'KeyValueMeta'

