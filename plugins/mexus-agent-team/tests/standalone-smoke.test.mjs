import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startMission } from '../scripts/start-mission.mjs'
import { teamStatus } from '../scripts/status.mjs'

const pluginRoot = path.resolve(new URL('..', import.meta.url).pathname)

for (const file of [
  '.codex-plugin/plugin.json',
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  'README.md',
  'skills/team/SKILL.md',
  'skills/run/SKILL.md',
  'skills/roundtable/SKILL.md',
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

for (const skill of ['team', 'run', 'roundtable', 'board', 'team-status', 'team-stop']) {
  const body = fs.readFileSync(path.join(pluginRoot, 'skills', skill, 'SKILL.md'), 'utf8')
  assert.match(body, /^---\n[\s\S]+?\n---\n/, `${skill} should have frontmatter`)
  assert.match(body, /description: .+/, `${skill} should have description`)
}

const boardSkill = fs.readFileSync(path.join(pluginRoot, 'skills/board/SKILL.md'), 'utf8')
assert.match(boardSkill, /--host 0\.0\.0\.0/)
assert.match(boardSkill, /--public-host/)

const startBoardScript = fs.readFileSync(path.join(pluginRoot, 'scripts/start-board.mjs'), 'utf8')
assert.match(startBoardScript, /host: '0\.0\.0\.0'/)
assert.match(startBoardScript, /--public-host/)

const claudePlugin = JSON.parse(fs.readFileSync(path.join(pluginRoot, '.claude-plugin/plugin.json'), 'utf8'))
assert.equal(claudePlugin.name, 'mexus-skill')

const codexPlugin = JSON.parse(fs.readFileSync(path.join(pluginRoot, '.codex-plugin/plugin.json'), 'utf8'))
assert.equal(codexPlugin.name, 'mexus-skill')

const marketplace = JSON.parse(fs.readFileSync(path.join(pluginRoot, '.claude-plugin/marketplace.json'), 'utf8'))
assert.equal(marketplace.name, 'mexus-skill')
assert.ok(Array.isArray(marketplace.plugins), 'marketplace plugins should be an array')
assert.ok(
  marketplace.plugins.some((plugin) => plugin.name === 'mexus-skill' && plugin.source === './'),
  'marketplace should include a bundle entry at ./',
)
for (const skill of ['team', 'run', 'roundtable', 'board', 'team-status', 'team-stop']) {
  assert.ok(
    marketplace.plugins.some(
      (plugin) => plugin.name === `mexus-skill-${skill}` && plugin.source === `./skills/${skill}`,
    ),
    `marketplace should include per-skill entry for ${skill}`,
  )
}

const readme = fs.readFileSync(path.join(pluginRoot, 'README.md'), 'utf8')
assert.match(readme, /\/mexus-skill:team/)
assert.match(readme, /\/mexus-skill:run/)
assert.match(readme, /\/mexus-skill:roundtable/)
assert.doesNotMatch(readme, /^\/team/m)

const forbiddenRuntimeTerms = [
  'mexus pane create',
  'mexus mission activate',
  'MissionInboxPipeline',
  'external A2A',
]
for (const rel of ['README.md', 'skills/team/SKILL.md']) {
  const body = fs.readFileSync(path.join(pluginRoot, rel), 'utf8')
  for (const term of forbiddenRuntimeTerms) {
    if (term === 'external A2A') {
      assert.match(body, /no external A2A|without external A2A|Do not use external A2A/i, `${rel} should explicitly reject external A2A`)
    } else {
      assert.ok(!body.includes(term), `${rel} should not depend on ${term}`)
    }
  }
  assert.match(body, /does not require.*Mission Inbox|no .*Mission Inbox|without .*Mission Inbox|must not .*Mission Inbox/i, `${rel} should reject Mission Inbox dependency`)
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mexus-agent-team-standalone-'))
const created = startMission([
  '--root',
  temp,
  '--name',
  'demo-mission',
  '--request',
  'Build a demo feature with background Agents',
])

assert.equal(created.mission, 'demo-mission')
assert.deepEqual(created.archived, [])

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

const mission = fs.readFileSync(path.join(temp, 'agent-team/missions/demo-mission/mission.md'), 'utf8')
assert.match(mission, /Execution mode: background-agents/)
assert.match(mission, /Do not require a Mexus server/)
assert.match(mission, /external A2A/)
assert.match(mission, /Each executing background Agent/)

const agents = fs.readFileSync(path.join(temp, 'agent-team/missions/demo-mission/agents.md'), 'utf8')
assert.match(agents, /Squad Lead: Squad Lead/)
assert.match(agents, /Agares/)
assert.match(agents, /background Agent/)
assert.match(agents, /Modules:/)
assert.match(agents, /kanban\.md is the communication channel/)
assert.doesNotMatch(agents, /Bael/)

const status = teamStatus(['--root', temp, '--name', 'demo-mission'])
assert.match(status, /Mission: demo-mission/)
assert.match(status, /Tasks: 1 to claim \/ 0 in progress \/ 0 done/)

const kanban = fs.readFileSync(path.join(temp, 'agent-team/missions/demo-mission/kanban.md'), 'utf8')
assert.match(kanban, /To: Agares \| From: Squad Lead/)
assert.doesNotMatch(kanban, /From: User|Updated: .*User/)
assert.doesNotMatch(kanban, /To: Squad Lead|Bael/)

const second = startMission([
  '--root',
  temp,
  '--name',
  'second-mission',
  '--request',
  'Build a second demo feature',
])
assert.equal(second.mission, 'second-mission')
assert.deepEqual(second.archived, ['demo-mission'])

const archivedMission = fs.readFileSync(path.join(temp, 'agent-team/missions/demo-mission/mission.md'), 'utf8')
const activeMission = fs.readFileSync(path.join(temp, 'agent-team/missions/second-mission/mission.md'), 'utf8')
assert.match(archivedMission, /Lifecycle: archived/)
assert.match(activeMission, /Lifecycle: active/)

console.log('mexus-agent-team standalone smoke passed')
