import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, ...props }, ref) => (
    <div className={cn('ui-search-input', className)}>
      <span className="ui-search-input__icon" aria-hidden="true">⌕</span>
      <input ref={ref} type="search" className="ui-search-input__control" {...props} />
    </div>
  ),
)

SearchInput.displayName = 'SearchInput'

