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
  const value = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return value || `mission-${today()}`
}

function writeIfMissing(file, content) {
  if (fs.existsSync(file)) return false
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
  return true
}

function readReference(name) {
  const file = new URL(`../references/${name}`, import.meta.url)
  return fs.readFileSync(file, 'utf8')
}

export function startMission(rawArgs = process.argv.slice(2)) {
  const args = parseArgs(rawArgs)
  if (!args.request.trim()) {
    console.error('Usage: start-mission.mjs --request "<mission request>" [--name <mission-name>] [--root <project-root>]')
    throw new Error('Usage: start-mission.mjs --request "<mission request>" [--name <mission-name>] [--root <project-root>]')
  }

  const root = path.resolve(args.root)
  const missionName = args.name.trim() || `${today()}-${slug(args.request)}`
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(missionName)) {
    throw new Error(`Invalid mission name: ${missionName}`)
  }

  const agentTeamDir = path.join(root, 'agent-team')
  const missionDir = path.join(agentTeamDir, 'missions', missionName)
  const date = today()
  const changed = []

  if (writeIfMissing(path.join(agentTeamDir, 'mission-workflow.md'), readReference('mission-workflow.md'))) {
    changed.push('agent-team/mission-workflow.md')
  }
  if (writeIfMissing(path.join(agentTeamDir, 'agents.md'), readReference('agent-roster-template.md'))) {
    changed.push('agent-team/agents.md')
  }

  const missionMd = `# Mission: ${missionName}

Mission: \`${missionName}\`

Created by: Squad Lead

Created at: ${date}

## Original Request

${args.request.trim()}

## Mission Intent

The Squad Lead should clarify the goal, acceptance standard, constraints, and roster before publishing implementation tasks.

## Strategic Constraints

- Coordinate work through \`kanban.md\`.
- Treat this first Mission setup task as the first assignment, not the complete future task list.
- Use host CLI subagents or Mexus panes according to the active runtime.

## Implementation Order

1. Clarify goal, acceptance, constraints, and agent roster.
2. Publish scoped implementation tasks in \`kanban.md\`.
3. Dispatch agents through the active runtime.
4. Review completed tasks before closing the Mission.

## Minimum Acceptance Standard

- The kanban has scoped tasks with clear owners, acceptance criteria, results, files, verification, and review notes.

## Notes

- The Markdown files are the source of truth.
`

  const agentsMd = `# Mission Agents

Mission: \`${missionName}\`

Squad Lead: Squad Lead

Purpose: This file defines the Mission roster. Agents coordinate through \`kanban.md\` and follow \`../../mission-workflow.md\`.

## Required Collaboration Context

Each agent should read:

- \`agent-team/mission-workflow.md\`
- \`agent-team/missions/${missionName}/mission.md\`
- \`agent-team/missions/${missionName}/agents.md\`
- \`agent-team/missions/${missionName}/kanban.md\`
- \`agent-team/missions/${missionName}/roundtable.md\`

## Agent Names

| Agent Name | Responsibility |
| --- | --- |
| Squad Lead | Mission clarification, task decomposition, routing, and review coordination |

## Recommended Execution Order

1. Squad Lead

## Agent: Squad Lead

Owner label: \`Squad Lead\`

Responsibility: Clarify Mission intent, define agent roster, publish scoped kanban tasks, route out-of-scope work, and review tasks where Squad Lead is the publisher.

Activation prompt:

\`\`\`text
You are Squad Lead, the agent responsible for mission coordination in mission \`${missionName}\`. First read agent-team/mission-workflow.md, agent-team/missions/${missionName}/mission.md, agents.md, kanban.md, and roundtable.md. Prioritize work assigned to To: Squad Lead in kanban.md. If a task assigned to Squad Lead does not fit this responsibility boundary, update kanban.md to reassign it to the appropriate Mission Agent with a brief reason in Updated. If you cannot confidently identify the right owner, keep or publish a clarification task to Squad Lead instead of guessing. Work through kanban.md as the source of truth.
\`\`\`

Initial prompt:

\`\`\`text
You are Squad Lead, the Mission agent responsible for coordination in mission \`${missionName}\`.

First assigned task: clarify the Mission, define a practical roster, and publish the first scoped implementation tasks in kanban.md.

This is your current first task, not the full set of work you may do in this Mission. Prioritize work assigned to To: Squad Lead in kanban.md. Later kanban tasks within your responsibility area may be assigned to Squad Lead.

Original request:
${args.request.trim()}

You are not alone in the codebase. Do not revert or overwrite changes made by others. Start by claiming your task in kanban.md. Finish by filling Result/Files/Verification, moving the task to Done, and checking for more assigned tasks or tasks you published that need Review.
\`\`\`
`

  const kanbanMd = `# Agent Team Kanban

Mission: \`${missionName}\`

Board owner: Squad Lead

Last updated: ${date}

## Board Usage Rules

This file is only for task state tracking. General collaboration rules live in \`../../mission-workflow.md\`.

## To Claim

To: Squad Lead | From: User | Scope: \`agent-team/missions/${missionName}\`
- Ref: ${Math.random().toString(16).slice(2, 8)}
- Request: Clarify the Mission, define the first roster, and publish scoped implementation tasks for the active runtime.
- Reason: The original request needs a concrete Mission plan before agents can execute safely.
- Acceptance: mission.md, agents.md, and kanban.md contain enough detail for at least one worker to start without guessing.
- Result:
- Files:
- Verification:
- Review:
- Updated: ${date}, User

## In Progress

No tasks claimed yet.

## Done

No tasks completed yet.
`

  const roundtableMd = readReference('roundtable-template.md')
    .replaceAll('<mission-name>', missionName)
    .replaceAll('<YYYY-MM-DD>', date)
  const squadLeadMd = readReference('squad-lead-template.md')
    .replaceAll('<mission-name>', missionName)
    .replaceAll('<YYYY-MM-DD>', date)

  for (const [name, content] of [
    ['mission.md', missionMd],
    ['agents.md', agentsMd],
    ['kanban.md', kanbanMd],
    ['roundtable.md', roundtableMd],
    ['squad-lead.md', squadLeadMd],
  ]) {
    const rel = path.join('agent-team', 'missions', missionName, name)
    if (writeIfMissing(path.join(root, rel), content)) changed.push(rel)
  }

  return { mission: missionName, root, missionDir, changed }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    console.log(JSON.stringify(startMission(), null, 2))
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}
