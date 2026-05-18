#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

function parseArgs(argv) {
  const args = { root: process.cwd(), name: '', request: '' }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--root') args.root = argv[++i] || args.root
    else if (arg === '--name') args.name = argv[++i] || ''
    else if (arg === '--request') args.request = argv[++i] || ''
    else if (!args.request) args.request = arg
    else args.request += ` ${arg}`
  }
  return args
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function slug(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || `mission-${today()}`
}

function writeIfMissing(file, content) {
  if (fs.existsSync(file)) return false
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
  return true
}

function readReference(name) {
  return fs.readFileSync(new URL(`../references/${name}`, import.meta.url), 'utf8')
}

function missionNameFrom(args) {
  return args.name.trim() || `${today()}-${slug(args.request)}`
}

function missionDirectories(agentTeamDir) {
  const missionsDir = path.join(agentTeamDir, 'missions')
  if (!fs.existsSync(missionsDir)) return []
  return fs.readdirSync(missionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => ({ name: entry.name, dir: path.join(missionsDir, entry.name) }))
}

function updateLifecycle(missionFile, lifecycle, date) {
  if (!fs.existsSync(missionFile)) return false
  const before = fs.readFileSync(missionFile, 'utf8')
  let after = before
  if (/^Lifecycle:\s*.*$/m.test(after)) {
    after = after.replace(/^Lifecycle:\s*.*$/m, `Lifecycle: ${lifecycle}`)
  } else {
    after = after.replace(/^(Mission:\s*`.*?`\s*)$/m, `$1\nLifecycle: ${lifecycle}`)
  }

  if (lifecycle === 'archived') {
    if (/^Archived at:\s*.*$/m.test(after)) after = after.replace(/^Archived at:\s*.*$/m, `Archived at: ${date}`)
    else after = after.replace(/^Lifecycle:\s*archived$/m, `Lifecycle: archived\n\nArchived at: ${date}`)
  } else {
    after = after.replace(/\nArchived at:\s*.*\n?/m, '\n')
  }

  if (after === before) return false
  fs.writeFileSync(missionFile, after)
  return true
}

function archiveOtherActiveMissions(agentTeamDir, activeName, date) {
  const archived = []
  for (const mission of missionDirectories(agentTeamDir)) {
    if (mission.name === activeName) continue
    const missionFile = path.join(mission.dir, 'mission.md')
    const body = fs.existsSync(missionFile) ? fs.readFileSync(missionFile, 'utf8') : ''
    if (/^Lifecycle:\s*active\s*$/m.test(body) && updateLifecycle(missionFile, 'archived', date)) {
      archived.push(mission.name)
    }
  }
  return archived
}

export function startMission(rawArgs = process.argv.slice(2)) {
  const args = parseArgs(rawArgs)
  if (!args.request.trim()) {
    throw new Error('Usage: start-mission.mjs --request "<mission request>" [--name <mission-name>] [--root <project-root>]')
  }

  const name = missionNameFrom(args)
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) throw new Error(`Invalid mission name: ${name}`)

  const root = path.resolve(args.root)
  const date = today()
  const agentTeamDir = path.join(root, 'agent-team')
  const missionDir = path.join(agentTeamDir, 'missions', name)
  const changed = []
  const archived = []
  const request = args.request.trim()

  if (writeIfMissing(path.join(agentTeamDir, 'mission-workflow.md'), readReference('mission-workflow.md'))) {
    changed.push('agent-team/mission-workflow.md')
  }
  if (writeIfMissing(path.join(agentTeamDir, 'agents.md'), readReference('agent-roster-template.md'))) {
    changed.push('agent-team/agents.md')
  }

  const missionMd = `# Mission: ${name}

Mission: \`${name}\`

Lifecycle: active

Execution mode: background-agents

Created by: Host Agent

Created at: ${date}

## Original Request

${request}

## Mission Intent

Use this Mission to coordinate the lead agent and background execution agents through Markdown kanban tasks.

## Strategic Constraints

- Do not require a Mexus server, panes, Mission Inbox, or external A2A messaging.
- Use \`kanban.md\` as the communication protocol between the lead agent and background agents.
- Each executing background Agent must write results back to its own kanban task block before finishing.

## Implementation Order

1. Squad Lead plans the executing Agents and publishes actionable kanban tasks before any worker execution starts.
2. Squad Lead starts Claude Code or Codex background Agents for the published tasks.
3. Each executing background Agent moves and updates its own task block in \`kanban.md\` with status, Result, Files, Verification, and Updated.
4. Squad Lead reviews Done tasks and closes the Mission.

## Minimum Acceptance Standard

- The kanban accurately shows task ownership, status, results, changed files, verification, and review notes.

## Notes

- This standalone plugin is Markdown-only. There is no external agent-to-agent transport.
`

  const agentsMd = `# Mission Agents

Mission: \`${name}\`

Squad Lead: Squad Lead

Purpose: This file defines execution roles for a Markdown-only Agent Team Mission. Squad Lead is a fixed coordination role, not a generated Agent name. Background Agents execute scoped tasks. All coordination goes through \`kanban.md\`.

## Required Collaboration Context

Each Agent should read:

- \`agent-team/mission-workflow.md\`
- \`agent-team/missions/${name}/mission.md\`
- \`agent-team/missions/${name}/agents.md\`
- \`agent-team/missions/${name}/kanban.md\`
- \`agent-team/missions/${name}/roundtable.md\`

## Agent Names

| Agent Name | Responsibility |
| --- | --- |
| Agares | Execute the first scoped implementation or investigation task planned by Squad Lead |

## Recommended Execution Order

1. Agares

## Agent: Agares

Owner label: \`Agares\`

Responsibility: Execute one scoped kanban task delegated by Squad Lead.

Modules:
- Repository files required by the assigned kanban task.
- Keep work inside the task Scope unless kanban is updated with a reassignment or follow-up task.

Activation prompt:

\`\`\`text
You are Agares, a background Agent executing one scoped task for mission \`${name}\`. Your name is only a collaboration handle and does not describe the task. Read agent-team/mission-workflow.md, agent-team/missions/${name}/mission.md, agents.md, kanban.md, and roundtable.md, then read the exact task block assigned by Squad Lead. This is your current first task, not the full set of work you may do in this Mission. Prioritize work assigned to To: Agares in kanban.md. If the assigned task does not fit Agares responsibility and the correct owner is clear, update kanban.md to reassign it to the appropriate Mission Agent with a brief reason in Updated. If you cannot confidently identify the right owner, publish a clarification task to Squad Lead instead of guessing. Claim only your task by moving the full task block to In Progress. Work within Scope. Self-test before completion. Fill Result, Files, Verification, and Updated in your own task block in kanban.md before reporting back, then move it to Done only after verification. Leave Review for the task publisher named in From. Do not use external A2A messaging; kanban.md is the communication channel.
\`\`\`
`

  const kanbanMd = `# Agent Team Kanban

Mission: \`${name}\`

Board owner: Squad Lead

Last updated: ${date}

## Board Usage Rules

This file is the communication protocol between the lead Agent and background Agents. General collaboration rules live in \`../../mission-workflow.md\`.

## Acceptance Flow

1. The task publisher writes \`To\`, \`From\`, \`Request\`, \`Reason\`, and \`Acceptance\`.
2. The task executor claims the task, executes it, self-tests it, fills \`Result\`, \`Files\`, \`Verification\`, and \`Updated\`, then moves it to \`Done\`.
3. The task publisher reviews the completed task and fills \`Review\`.
4. If the task fails review, the publisher creates a new focused task under \`To Claim\` instead of editing the executor's result.

Squad Lead performs overall Mission acceptance separately. If the Mission result is below expectation, Squad Lead publishes new focused tasks to the responsible Agents and those Agents continue from the new tasks.

## Responsibility Mismatch

- If the assigned task does not fit the \`To\` Agent's responsibility and the correct owner is clear, change \`To\` to the correct Agent and explain the reassignment in \`Updated\`.
- If the correct owner is unclear, publish a clarification task to \`Squad Lead\`.
- Do not execute outside the declared responsibility or module scope.

## To Claim

To: Agares | From: Squad Lead | Scope: \`.\`
- Ref: ${Math.random().toString(16).slice(2, 8)}
- Request: Execute the first scoped implementation or investigation slice for the Mission request: ${request}
- Reason: Squad Lead planned this as the first actionable background Agent task after creating the Mission.
- Acceptance: The task produces a concrete result, changed or inspected files are recorded, and verification is documented in this task block.
- Result:
- Files:
- Verification:
- Review:
- Updated: ${date}, Squad Lead

## In Progress

No tasks claimed yet.

## Done

No tasks completed yet.
`

  const roundtableMd = readReference('roundtable-template.md').replaceAll('<mission-name>', name).replaceAll('<YYYY-MM-DD>', date)
  const squadLeadMd = readReference('squad-lead-template.md')
    .replaceAll('<mission-name>', name)
    .replaceAll('<YYYY-MM-DD>', date)

  for (const [file, content] of [
    ['mission.md', missionMd],
    ['agents.md', agentsMd],
    ['kanban.md', kanbanMd],
    ['roundtable.md', roundtableMd],
    ['squad-lead.md', squadLeadMd],
  ]) {
    const rel = path.join('agent-team', 'missions', name, file)
    if (writeIfMissing(path.join(root, rel), content)) changed.push(rel)
  }

  if (updateLifecycle(path.join(missionDir, 'mission.md'), 'active', date)) {
    changed.push(path.join('agent-team', 'missions', name, 'mission.md'))
  }
  archived.push(...archiveOtherActiveMissions(agentTeamDir, name, date))

  return { mission: name, root, missionDir, changed: [...new Set(changed)], archived }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    console.log(JSON.stringify(startMission(), null, 2))
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}
