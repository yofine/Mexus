import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TabListProps extends React.HTMLAttributes<HTMLDivElement> {}

export const TabList = React.forwardRef<HTMLDivElement, TabListProps>(
  ({ className, role = 'tablist', ...props }, ref) => (
    <div ref={ref} role={role} className={cn('ui-tab-list', className)} {...props} />
  ),
)

TabList.displayName = 'TabList'

export interface TabButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

export const TabButton = React.forwardRef<HTMLButtonElement, TabButtonProps>(
  ({ className, active = false, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      role="tab"
      aria-selected={active}
      className={cn('ui-tab-button', active && 'ui-tab-button--active', className)}
      {...props}
    />
  ),
)

TabButton.displayName = 'TabButton'

