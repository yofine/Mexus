export type MissionTaskStatus = 'To Claim' | 'In Progress' | 'Done'
export type RoundtableSection = 'Pending Review' | 'Approved' | 'Rejected'
export type RoundtableVoteState = 'approve' | 'reject' | 'abstain' | 'pending'

export interface MissionTask {
  to: string
  from: string
  scope: string
  ref?: string
  request?: string
  reason?: string
  acceptance?: string
  result?: string
  files?: string
  verification?: string
  review?: string
  updated?: string
  clarification?: string
  question?: string
  raw: string
  line: number
}

export interface MissionKanbanTasks {
  toClaim: MissionTask[]
  inProgress: MissionTask[]
  done: MissionTask[]
}

export interface MissionKanbanParseResult {
  ok: boolean
  raw: string
  error?: string
  tasks: MissionKanbanTasks
}

export interface RoundtableVote {
  agent: string
  vote: RoundtableVoteState
  reason?: string
}

export interface RoundtableItem {
  section: RoundtableSection
  ref: string
  topic: string
  openedBy: string
  invitees: string[]
  scope: string
  votes: RoundtableVote[]
  decision?: string
  updated?: string
  raw: string
  line: number
}

export interface MissionRoundtableParseResult {
  ok: boolean
  raw: string
  error?: string
  items: RoundtableItem[]
}

const EMPTY_KANBAN: MissionKanbanTasks = { toClaim: [], inProgress: [], done: [] }
const KANBAN_SECTIONS: Array<{ heading: MissionTaskStatus; key: keyof MissionKanbanTasks }> = [
  { heading: 'To Claim', key: 'toClaim' },
  { heading: 'In Progress', key: 'inProgress' },
  { heading: 'Done', key: 'done' },
]
const ROUNDTABLE_SECTIONS: RoundtableSection[] = ['Pending Review', 'Approved', 'Rejected']

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeInlineMarkdown(value: string): string {
  return value.trim().replace(/`([^`]+)`/g, '$1').trim()
}

function sectionAfterHeading(markdown: string, heading: string): { body: string; offset: number } | null {
  const match = new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, 'm').exec(markdown)
  if (!match) return null
  const start = match.index + match[0].length
  const next = /^##\s+/m.exec(markdown.slice(start))
  const end = next ? start + next.index : markdown.length
  return { body: markdown.slice(start, end).trim(), offset: start }
}

function lineNumberAt(markdown: string, offset: number): number {
  return markdown.slice(0, offset).split(/\r?\n/).length
}

function parseDashedField(block: string, field: string): string | undefined {
  const lines = block.split(/\r?\n/)
  const start = lines.findIndex((line) => line.startsWith(`- ${field}:`))
  if (start === -1) return undefined
  const first = lines[start].slice(`- ${field}:`.length).trim()
  const rest: string[] = []
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^- [A-Z][A-Za-z -]*:\s*/.test(lines[index]) || /^To:\s/.test(lines[index]) || /^Ref:\s/.test(lines[index])) break
    rest.push(lines[index])
  }
  const value = [first, ...rest].join('\n').trim()
  return value || undefined
}

function parseTaskBlock(raw: string, line: number): MissionTask | null {
  const header = /^To:\s*(.*?)\s*\|\s*From:\s*(.*?)\s*\|\s*Scope:\s*(.*?)\s*$/m.exec(raw)
  if (!header) return null
  return {
    to: header[1].trim(),
    from: header[2].trim(),
    scope: normalizeInlineMarkdown(header[3]),
    ref: parseDashedField(raw, 'Ref'),
    request: parseDashedField(raw, 'Request'),
    reason: parseDashedField(raw, 'Reason'),
    acceptance: parseDashedField(raw, 'Acceptance'),
    result: parseDashedField(raw, 'Result'),
    files: parseDashedField(raw, 'Files'),
    verification: parseDashedField(raw, 'Verification'),
    review: parseDashedField(raw, 'Review'),
    clarification: parseDashedField(raw, 'Clarification'),
    question: parseDashedField(raw, 'Question'),
    updated: parseDashedField(raw, 'Updated'),
    raw,
    line,
  }
}

function parseTasks(markdown: string, section: { body: string; offset: number } | null): MissionTask[] {
  if (!section || !section.body || /^No tasks /m.test(section.body)) return []
  return [...section.body.matchAll(/^To:\s.*(?:\r?\n(?!To:\s|##\s).*)*/gm)]
    .map((match) => parseTaskBlock(match[0].trim(), lineNumberAt(markdown, section.offset + (match.index || 0))))
    .filter((task): task is MissionTask => Boolean(task))
}

export function parseMissionKanban(markdown: string): MissionKanbanParseResult {
  const sections = KANBAN_SECTIONS.map(({ heading }) => sectionAfterHeading(markdown, heading))
  if (sections.some((section) => section === null)) {
    return {
      ok: false,
      raw: markdown,
      error: 'Kanban sections To Claim, In Progress, and Done were not all found.',
      tasks: { ...EMPTY_KANBAN },
    }
  }

  return {
    ok: true,
    raw: markdown,
    tasks: {
      toClaim: parseTasks(markdown, sections[0]),
      inProgress: parseTasks(markdown, sections[1]),
      done: parseTasks(markdown, sections[2]),
    },
  }
}

function parseTopLevelField(block: string, field: string): string | undefined {
  const match = new RegExp(`^${escapeRegExp(field)}:\\s*(.+)$`, 'm').exec(block)
  return match ? normalizeInlineMarkdown(match[1]) : undefined
}

function parseInvitees(value: string | undefined): string[] {
  return (value || '')
    .split(/[,|]/)
    .map((invitee) => invitee.trim())
    .filter(Boolean)
}

function parseVoteLine(line: string): RoundtableVote | null {
  const match = /^\s*-\s*([^:]+):\s*(approve|reject|abstain|pending)\b\s*(?:[—-]\s*(.*))?$/i.exec(line)
  if (!match) return null
  return {
    agent: match[1].trim(),
    vote: match[2].toLowerCase() as RoundtableVoteState,
    reason: match[3]?.trim() || undefined,
  }
}

function parseVotes(block: string): RoundtableVote[] {
  const lines = block.split(/\r?\n/)
  const start = lines.findIndex((line) => /^- Votes:\s*$/.test(line))
  if (start === -1) return []
  const votes: RoundtableVote[] = []
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^- [A-Z][A-Za-z -]*:\s*/.test(lines[index])) break
    const vote = parseVoteLine(lines[index])
    if (vote) votes.push(vote)
  }
  return votes
}

function parseRoundtableItem(block: string, section: RoundtableSection, line: number): RoundtableItem | null {
  const ref = parseTopLevelField(block, 'Ref')
  if (!ref) return null
  return {
    section,
    ref,
    topic: parseTopLevelField(block, 'Topic') || '',
    openedBy: parseTopLevelField(block, 'Opened by') || '',
    invitees: parseInvitees(parseTopLevelField(block, 'Invitees')),
    scope: parseTopLevelField(block, 'Scope') || '',
    votes: parseVotes(block),
    decision: parseDashedField(block, 'Decision'),
    updated: parseDashedField(block, 'Updated'),
    raw: block,
    line,
  }
}

function parseRoundtableSection(markdown: string, sectionName: RoundtableSection): RoundtableItem[] {
  const section = sectionAfterHeading(markdown, sectionName)
  if (!section || !section.body || /^No review items /m.test(section.body)) return []
  return [...section.body.matchAll(/^Ref:\s.*(?:\r?\n(?!Ref:\s|##\s).*)*/gm)]
    .map((match) => parseRoundtableItem(match[0].trim(), sectionName, lineNumberAt(markdown, section.offset + (match.index || 0))))
    .filter((item): item is RoundtableItem => Boolean(item))
}

export function parseMissionRoundtable(markdown: string): MissionRoundtableParseResult {
  const items = ROUNDTABLE_SECTIONS.flatMap((section) => parseRoundtableSection(markdown, section))
  if (items.length === 0) {
    return {
      ok: false,
      raw: markdown,
      error: 'No roundtable review item blocks found.',
      items: [],
    }
  }
  return { ok: true, raw: markdown, items }
}
