export type InboxEventKind = 'task-assigned' | 'review-pending' | 'roundtable-vote' | 'roundtable-progress' | 'clarification'

export interface InboxEvent {
  id: string
  kind: InboxEventKind
  agentName: string
  ref: string
  scope?: string
  taskTitle?: string
  doneByAgent?: string
  topic?: string
  requesterAgent?: string
  createdAt: string
}

export interface InboxState {
  deduped: string[]
  pending: InboxEvent[]
}
