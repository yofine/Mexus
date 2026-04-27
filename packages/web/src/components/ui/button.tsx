import * as React from 'react'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'default' | 'sm' | 'icon'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'default', ...props }, ref) => (
    <button
      ref={ref}
      className={cn('ui-button', `ui-button--${variant}`, `ui-button--${size}`, className)}
      {...props}
    />
  ),
)

Button.displayName = 'Button'
