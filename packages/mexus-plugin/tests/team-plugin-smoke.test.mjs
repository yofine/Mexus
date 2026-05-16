import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startMission } from '../scripts/start-mission.mjs'
import { teamStatus } from '../scripts/status.mjs'

const pluginRoot = path.resolve(new URL('..', import.meta.url).pathname)

for (const file of [
  '.claude-plugin/plugin.json',
  'hooks/hooks.json',
  'hooks/session-start.sh',
  'skills/team/SKILL.md',
  'skills/board/SKILL.md',
  'skills/team-status/SKILL.md',
  'skills/team-stop/SKILL.md',
  'skills/board/board-app/package.json',
  'references/mission-workflow.md',
  'references/agent-roster-template.md',
  'references/mission-template.md',
  'references/agents-template.md',
  'references/kanban-template.md',
  'references/roundtable-template.md',
  'references/squad-lead-template.md',
  'scripts/start-mission.mjs',
  'scripts/status.mjs',
  'scripts/start-board.mjs',
  'scripts/stop-board.mjs',
]) {
  assert.ok(fs.existsSync(path.join(pluginRoot, file)), `${file} should exist`)
}

for (const skill of ['team', 'board', 'team-status', 'team-stop']) {
  const body = fs.readFileSync(path.join(pluginRoot, 'skills', skill, 'SKILL.md'), 'utf8')
  assert.match(body, /^---\nname: /, `${skill} should have skill frontmatter`)
  assert.match(body, /description: .+/, `${skill} should have a description`)
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mexus-team-plugin-'))
startMission([
  '--root',
  temp,
  '--name',
  'demo-mission',
  '--request',
  'Build a demo feature',
])

for (const file of [
  'agent-team/mission-workflow.md',
  'agent-team/agents.md',
  'agent-team/missions/demo-mission/mission.md',
  'agent-team/missions/demo-mission/agents.md',
  'agent-team/missions/demo-mission/kanban.md',
  'agent-team/missions/demo-mission/roundtable.md',
  'agent-team/missions/demo-mission/squad-lead.md',
]) {
  assert.ok(fs.existsSync(path.join(temp, file)), `${file} should be generated`)
}

const status = teamStatus([
  '--root',
  temp,
  '--name',
  'demo-mission',
])

assert.match(status, /Mission: demo-mission/)
assert.match(status, /Tasks: 1 to claim \/ 0 in progress \/ 0 done/)

console.log('mexus-plugin team smoke passed')
