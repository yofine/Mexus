import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TreeContainerProps extends React.HTMLAttributes<HTMLDivElement> {}

export const TreeContainer = React.forwardRef<HTMLDivElement, TreeContainerProps>(
  ({ className, role = 'tree', ...props }, ref) => (
    <div ref={ref} role={role} className={cn('ui-tree-container', className)} {...props} />
  ),
)

TreeContainer.displayName = 'TreeContainer'

export interface TreeNodeRowProps extends React.HTMLAttributes<HTMLDivElement> {
  depth?: number
  name: React.ReactNode
  kind?: 'file' | 'directory'
  expanded?: boolean
  active?: boolean
  gitStatus?: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
  agentColor?: string
}

export const TreeNodeRow = React.forwardRef<HTMLDivElement, TreeNodeRowProps>(
  ({ className, depth = 0, name, kind = 'file', expanded, active, gitStatus, agentColor, style, ...props }, ref) => (
    <div
      ref={ref}
      role="treeitem"
      aria-expanded={kind === 'directory' ? Boolean(expanded) : undefined}
      className={cn('ui-tree-node-row', `ui-tree-node-row--${kind}`, active && 'ui-tree-node-row--active', gitStatus && `ui-tree-node-row--${gitStatus}`, className)}
      style={{ ...style, ['--tree-depth' as string]: depth, ['--agent-color' as string]: agentColor }}
      {...props}
    >
      <span className="ui-tree-node-row__twisty" aria-hidden="true">{kind === 'directory' ? (expanded ? '▾' : '▸') : ''}</span>
      <span className="ui-tree-node-row__name">{name}</span>
      {gitStatus && <span className="ui-tree-node-row__git">{gitStatus[0]}</span>}
      {agentColor && <span className="ui-tree-node-row__agent" aria-hidden="true" />}
    </div>
  ),
)

TreeNodeRow.displayName = 'TreeNodeRow'

