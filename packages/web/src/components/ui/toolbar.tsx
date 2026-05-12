import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Toolbar = React.forwardRef<HTMLDivElement, ToolbarProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('ui-toolbar', className)} {...props} />
  ),
)

Toolbar.displayName = 'Toolbar'

export interface ToolbarGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ToolbarGroup = React.forwardRef<HTMLDivElement, ToolbarGroupProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('ui-toolbar-group', className)} {...props} />
  ),
)

ToolbarGroup.displayName = 'ToolbarGroup'

