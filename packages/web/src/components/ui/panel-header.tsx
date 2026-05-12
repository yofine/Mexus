import * as React from 'react'
import { cn } from '@/lib/utils'

export interface PanelHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  leading?: React.ReactNode
  actions?: React.ReactNode
}

export const PanelHeader = React.forwardRef<HTMLDivElement, PanelHeaderProps>(
  ({ className, eyebrow, title, description, leading, actions, ...props }, ref) => (
    <div ref={ref} className={cn('ui-panel-header', className)} {...props}>
      {leading && <div className="ui-panel-header__leading">{leading}</div>}
      <div className="ui-panel-header__content">
        {eyebrow && <div className="ui-panel-header__eyebrow">{eyebrow}</div>}
        <div className="ui-panel-header__title">{title}</div>
        {description && <div className="ui-panel-header__description">{description}</div>}
      </div>
      {actions && <div className="ui-panel-header__actions">{actions}</div>}
    </div>
  ),
)

PanelHeader.displayName = 'PanelHeader'
