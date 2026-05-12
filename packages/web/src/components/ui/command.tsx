import * as React from 'react'
import { cn } from '@/lib/utils'

export interface CommandGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  heading: React.ReactNode
}

export const CommandGroup = React.forwardRef<HTMLDivElement, CommandGroupProps>(
  ({ className, heading, children, ...props }, ref) => (
    <div ref={ref} className={cn('ui-command-group', className)} {...props}>
      <div className="ui-command-group__heading">{heading}</div>
      <div className="ui-command-group__items">{children}</div>
    </div>
  ),
)

CommandGroup.displayName = 'CommandGroup'

export interface CommandItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: React.ReactNode
  icon?: React.ReactNode
  shortcut?: React.ReactNode
  description?: React.ReactNode
}

export const CommandItem = React.forwardRef<HTMLButtonElement, CommandItemProps>(
  ({ className, label, icon, shortcut, description, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={cn('ui-command-item', className)} {...props}>
      {icon && <span className="ui-command-item__icon">{icon}</span>}
      <span className="ui-command-item__content">
        <span className="ui-command-item__label">{label}</span>
        {description && <span className="ui-command-item__description">{description}</span>}
      </span>
      {shortcut && <kbd className="ui-command-item__shortcut">{shortcut}</kbd>}
    </button>
  ),
)

CommandItem.displayName = 'CommandItem'

