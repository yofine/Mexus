import * as React from 'react'
import { AgentIcon } from '@/components/AgentIcon'
import { cn } from '@/lib/utils'
import type { AgentType } from '@/types'

export interface AgentIdentityProps extends React.HTMLAttributes<HTMLDivElement> {
  agent: AgentType | string
  name: React.ReactNode
  detail?: React.ReactNode
  color?: string
}

export const AgentIdentity = React.forwardRef<HTMLDivElement, AgentIdentityProps>(
  ({ className, agent, name, detail, color, style, ...props }, ref) => (
    <div ref={ref} className={cn('ui-agent-identity', className)} style={{ ...style, ['--agent-color' as string]: color }} {...props}>
      <span className="ui-agent-identity__mark" aria-hidden="true">
        <AgentIcon agent={agent} size="16px" />
      </span>
      <span className="ui-agent-identity__text">
        <span className="ui-agent-identity__name">{name}</span>
        {detail && <span className="ui-agent-identity__detail">{detail}</span>}
      </span>
    </div>
  ),
)

AgentIdentity.displayName = 'AgentIdentity'

