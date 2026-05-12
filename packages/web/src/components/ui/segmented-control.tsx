import * as React from 'react'
import { cn } from '@/lib/utils'

export type SegmentedControlOption = {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

export interface SegmentedControlProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: string
  options: SegmentedControlOption[]
  onValueChange: (value: string) => void
}

export const SegmentedControl = React.forwardRef<HTMLDivElement, SegmentedControlProps>(
  ({ className, value, options, onValueChange, ...props }, ref) => (
    <div ref={ref} className={cn('ui-segmented-control', className)} role="tablist" {...props}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={option.disabled}
            className={cn('ui-segmented-control__item', active && 'ui-segmented-control__item--active')}
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  ),
)

SegmentedControl.displayName = 'SegmentedControl'

