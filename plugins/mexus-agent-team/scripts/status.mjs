#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

function parseArgs(argv) {
  const args = { root: process.cwd(), name: '' }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root') args.root = argv[++i] || args.root
    else if (argv[i] === '--name') args.name = argv[++i] || ''
  }
  return args
}

function newestMission(missionsDir) {
  if (!fs.existsSync(missionsDir)) return ''
  return fs.readdirSync(missionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => {
      const file = path.join(missionsDir, entry.name, 'kanban.md')
      const mtime = fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0
      return { name: entry.name, mtime }
    })
    .sort((a, b) => b.mtime - a.mtime)[0]?.name || ''
}

function parseTasks(markdown) {
  const statuses = ['To Claim', 'In Progress', 'Done']
  const tasks = []
  for (let i = 0; i < statuses.length; i += 1) {
    const status = statuses[i]
    const next = statuses[i + 1]
    const start = markdown.indexOf(`## ${status}`)
    if (start === -1) continue
    const end = next ? markdown.indexOf(`## ${next}`, start + 1) : markdown.length
    const body = markdown.slice(start, end === -1 ? markdown.length : end)
    const blocks = body.split(/(?=^To:\s)/m).filter((block) => block.startsWith('To:'))
    for (const block of blocks) {
      const header = block.match(/^To:\s*(.*?)\s*\|\s*From:\s*(.*?)\s*\|\s*Scope:\s*(.*)$/m)
      if (!header) continue
      const ref = block.match(/^- Ref:\s*(.*)$/m)?.[1]?.trim() || ''
      const request = block.match(/^- Request:\s*(.*)$/m)?.[1]?.trim() || ''
      const updated = block.match(/^- Updated:\s*(.*)$/m)?.[1]?.trim() || ''
      tasks.push({ status, to: header[1].trim(), from: header[2].trim(), scope: header[3].trim(), ref, request, updated })
    }
  }
  return tasks
}

export function teamStatus(rawArgs = process.argv.slice(2)) {
  const args = parseArgs(rawArgs)
  const root = path.resolve(args.root)
  const missionsDir = path.join(root, 'agent-team', 'missions')
  const mission = args.name || newestMission(missionsDir)
  if (!mission) {
    throw new Error('No Agent Team mission found. Run /mexus-skill:team "<request>" first.')
  }

  const kanbanFile = path.join(missionsDir, mission, 'kanban.md')
  if (!fs.existsSync(kanbanFile)) {
    throw new Error(`Missing kanban.md for mission: ${mission}`)
  }

  const tasks = parseTasks(fs.readFileSync(kanbanFile, 'utf8'))
  const counts = {
    toClaim: tasks.filter((task) => task.status === 'To Claim').length,
    inProgress: tasks.filter((task) => task.status === 'In Progress').length,
    done: tasks.filter((task) => task.status === 'Done').length,
  }
  const byAgent = new Map()
  for (const task of tasks) {
    const list = byAgent.get(task.to) || []
    list.push(task)
    byAgent.set(task.to, list)
  }

  const lines = []
  lines.push(`Mission: ${mission}`)
  lines.push(`Tasks: ${counts.toClaim} to claim / ${counts.inProgress} in progress / ${counts.done} done`)
  for (const [agent, agentTasks] of [...byAgent.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`\n${agent}`)
    for (const task of agentTasks) {
      lines.push(`- [${task.status}] ${task.ref || 'no-ref'} ${task.request}`)
    }
  }
  return lines.join('\n')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    console.log(teamStatus())
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}
