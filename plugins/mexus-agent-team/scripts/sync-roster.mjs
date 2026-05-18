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

function today() {
  return new Date().toISOString().slice(0, 10)
}

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}

function writeText(file, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
}

function newestMission(missionsDir) {
  if (!fs.existsSync(missionsDir)) return ''
  return fs.readdirSync(missionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => {
      const file = path.join(missionsDir, entry.name, 'mission.md')
      const mtime = fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0
      return { name: entry.name, mtime }
    })
    .sort((a, b) => b.mtime - a.mtime)[0]?.name || ''
}

function activeMission(missionsDir) {
  if (!fs.existsSync(missionsDir)) return ''
  for (const entry of fs.readdirSync(missionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue
    const body = readText(path.join(missionsDir, entry.name, 'mission.md'))
    if (/^Lifecycle:\s*active\s*$/m.test(body)) return entry.name
  }
  return newestMission(missionsDir)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function section(markdown, heading) {
  const marker = `## ${heading}`
  const start = markdown.indexOf(marker)
  if (start === -1) return ''
  const bodyStart = start + marker.length
  const next = markdown.indexOf('\n## ', bodyStart)
  return markdown.slice(bodyStart, next === -1 ? markdown.length : next).trim()
}

function parseMissionAgents(markdown) {
  const table = markdown.match(/\| Agent Name \| Responsibility \|[\s\S]*?(?=\n## |$)/)?.[0] || ''
  return table.split('\n')
    .filter((line) => line.startsWith('|') && !line.includes('---') && !line.includes('Agent Name'))
    .map((line) => line.split('|').map((part) => part.trim()).filter(Boolean))
    .filter((parts) => parts.length >= 2)
    .map(([rawName, tableResponsibility]) => {
      const name = rawName.replace(/`/g, '')
      const detail = section(markdown, `Agent: ${name}`)
      const responsibility = detail.match(/^Responsibility:\s*([\s\S]*?)(?:\n\n|$)/m)?.[1]?.trim() || tableResponsibility
      const modulesBlock = detail.match(/^(?:Modules|Responsible modules|Files|Scope):\s*([\s\S]*?)(?:\n\n|$)/m)?.[1]?.trim() || ''
      const modules = modulesBlock.split('\n').map((line) => line.replace(/^[-*]\s+/, '').trim()).filter(Boolean)
      return { name, responsibility, modules }
    })
}

function parseKanbanTasks(markdown) {
  const tasks = []
  const statuses = ['To Claim', 'In Progress', 'Done']
  for (const status of statuses) {
    const body = section(markdown, status)
    for (const block of body.split(/(?=^To:\s)/m).filter((item) => item.startsWith('To:'))) {
      const header = block.match(/^To:\s*(.*?)\s*\|\s*From:\s*(.*?)\s*\|\s*Scope:\s*(.*)$/m)
      if (!header) continue
      const field = (name) => block.match(new RegExp(`^- ${escapeRegExp(name)}:\\s*(.*)$`, 'm'))?.[1]?.trim() || ''
      tasks.push({
        status,
        to: header[1].trim(),
        from: header[2].trim(),
        scope: header[3].trim(),
        ref: field('Ref'),
        request: field('Request'),
        result: field('Result'),
        review: field('Review'),
        updated: field('Updated'),
      })
    }
  }
  return tasks
}

function splitScope(scope) {
  const backtickMatches = [...scope.matchAll(/`([^`]+)`/g)].map((match) => match[1].trim())
  const raw = backtickMatches.length > 0 ? backtickMatches : scope.split(',')
  return raw.map((item) => item.trim()).filter(Boolean)
}

function listBlock(title, items) {
  const unique = [...new Set(items.filter(Boolean))]
  if (unique.length === 0) return `${title}:\n- <none recorded>`
  return `${title}:\n${unique.map((item) => `- ${item.startsWith('`') ? item : `\`${item}\``}`).join('\n')}`
}

function bulletBlock(title, items) {
  const unique = [...new Set(items.filter(Boolean))]
  if (unique.length === 0) return `${title}:\n- <none recorded>`
  return `${title}:\n${unique.map((item) => `- ${item}`).join('\n')}`
}

function parseProfiles(roster) {
  const firstProfile = roster.search(/^##\s+\S+/m)
  const header = firstProfile === -1 ? roster.trimEnd() : roster.slice(0, firstProfile).trimEnd()
  const rest = firstProfile === -1 ? '' : roster.slice(firstProfile)
  const profiles = new Map()
  const matches = [...rest.matchAll(/^##\s+(.+?)\s*$/gm)]
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]
    const start = match.index || 0
    const end = matches[i + 1]?.index ?? rest.length
    profiles.set(match[1].trim(), rest.slice(start, end).trim())
  }
  return { header, profiles }
}

function parseBullets(profile, title) {
  const body = profile.match(new RegExp(`${escapeRegExp(title)}:\\n([\\s\\S]*?)(?:\\n\\n|$)`))?.[1] || ''
  return body.split('\n').map((line) => line.replace(/^-\s+/, '').trim()).filter(Boolean)
}

function upsertProfile(existing, agent, missionName, acceptedTasks, date) {
  const modules = parseBullets(existing, 'Primary modules')
    .filter((item) => item !== '<none recorded>')
    .concat(agent.modules)
    .concat(acceptedTasks.flatMap((task) => splitScope(task.scope)))
  const strengths = parseBullets(existing, 'Known strengths')
    .filter((item) => item !== '<none recorded>')
    .concat(agent.responsibility ? [agent.responsibility.replace(/\.$/, '')] : [])
  const history = parseBullets(existing, 'Work history')
    .filter((item) => item !== '<none recorded>')
    .filter((item) => !item.includes(`<!-- roster-sync:${missionName}:${agent.name} -->`))
  const refs = acceptedTasks.map((task) => task.ref).filter(Boolean)
  if (acceptedTasks.length > 0) {
    history.push(`${date} | \`${missionName}\` | ${agent.responsibility} | ${acceptedTasks.length} accepted task(s)${refs.length > 0 ? `: ${refs.join(', ')}` : ''} <!-- roster-sync:${missionName}:${agent.name} -->`)
  }
  const notes = parseBullets(existing, 'Notes')
    .filter((item) => item !== '<none recorded>')
  const defaultNote = `Reuse ${agent.name} for future Missions that touch ${agent.responsibility.replace(/\.$/, '')}.`

  return `## ${agent.name}

${listBlock('Primary modules', modules)}

${bulletBlock('Known strengths', strengths)}

${bulletBlock('Work history', history)}

${bulletBlock('Notes', notes.length > 0 ? notes : [defaultNote])}`
}

export function syncRoster(rawArgs = process.argv.slice(2)) {
  const args = parseArgs(rawArgs)
  const root = path.resolve(args.root)
  const agentTeamDir = path.join(root, 'agent-team')
  const missionsDir = path.join(agentTeamDir, 'missions')
  const missionName = args.name || activeMission(missionsDir)
  if (!missionName) throw new Error('No Agent Team mission found. Run /mexus-skill:team "<request>" first.')

  const missionDir = path.join(missionsDir, missionName)
  const rosterFile = path.join(agentTeamDir, 'agents.md')
  const roster = readText(rosterFile) || readText(new URL('../references/agent-roster-template.md', import.meta.url).pathname)
  const agents = parseMissionAgents(readText(path.join(missionDir, 'agents.md')))
  const tasks = parseKanbanTasks(readText(path.join(missionDir, 'kanban.md')))
  const { header, profiles } = parseProfiles(roster)
  const date = today()
  const changed = []

  for (const agent of agents) {
    const acceptedTasks = tasks.filter((task) => task.to === agent.name && task.status === 'Done' && task.review.trim())
    const before = profiles.get(agent.name) || ''
    const after = upsertProfile(before, agent, missionName, acceptedTasks, date)
    if (before.trim() !== after.trim()) changed.push(agent.name)
    profiles.set(agent.name, after)
  }

  const body = `${header}\n\n${[...profiles.values()].join('\n\n')}\n`
  writeText(rosterFile, body)
  return { mission: missionName, rosterFile, changed }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = syncRoster()
    console.log(`Synced repository agent roster from mission: ${result.mission}`)
    console.log(`Updated agents: ${result.changed.length > 0 ? result.changed.join(', ') : 'none'}`)
    console.log(result.rosterFile)
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}
