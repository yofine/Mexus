export type TaskStatus = 'To Claim' | 'In Progress' | 'Done'

export interface KanbanTask {
  status: TaskStatus
  to: string
  from: string
  scope: string
  ref: string
  request: string
  updated: string
  review: string
}

const STATUSES: TaskStatus[] = ['To Claim', 'In Progress', 'Done']

function field(block: string, name: string) {
  return block.match(new RegExp(`^- ${name}:\\s*(.*)$`, 'm'))?.[1]?.trim() || ''
}

export function parseKanban(markdown: string): KanbanTask[] {
  const tasks: KanbanTask[] = []
  for (let i = 0; i < STATUSES.length; i += 1) {
    const status = STATUSES[i]
    const next = STATUSES[i + 1]
    const start = markdown.indexOf(`## ${status}`)
    if (start === -1) continue
    const end = next ? markdown.indexOf(`## ${next}`, start + 1) : markdown.length
    const body = markdown.slice(start, end === -1 ? markdown.length : end)
    const blocks = body.split(/(?=^To:\s)/m).filter((block) => block.startsWith('To:'))
    for (const block of blocks) {
      const header = block.match(/^To:\s*(.*?)\s*\|\s*From:\s*(.*?)\s*\|\s*Scope:\s*(.*)$/m)
      if (!header) continue
      tasks.push({
        status,
        to: header[1].trim(),
        from: header[2].trim(),
        scope: header[3].trim(),
        ref: field(block, 'Ref'),
        request: field(block, 'Request'),
        updated: field(block, 'Updated'),
        review: field(block, 'Review'),
      })
    }
  }
  return tasks
}

export function counts(tasks: KanbanTask[]) {
  return {
    toClaim: tasks.filter((task) => task.status === 'To Claim').length,
    inProgress: tasks.filter((task) => task.status === 'In Progress').length,
    done: tasks.filter((task) => task.status === 'Done').length,
  }
}
