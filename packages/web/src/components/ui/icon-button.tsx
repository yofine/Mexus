import * as React from 'react'
import { cn } from '@/lib/utils'

type IconButtonVariant = 'ghost' | 'secondary' | 'danger' | 'accent'
type IconButtonSize = 'sm' | 'md' | 'lg'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant
  size?: IconButtonSize
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'ghost', size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn('ui-icon-button', `ui-icon-button--${variant}`, `ui-icon-button--${size}`, className)}
      {...props}
    />
  ),
)

IconButton.displayName = 'IconButton'

