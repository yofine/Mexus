import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const skillRoot = new URL("..", import.meta.url);

const expectedSkills = [
  {
    dir: "mission-create",
    required: [
      "name: mission-create",
      "mexus pane create",
      "--mission-role squad-lead",
      "--mission-agent \"Squad Lead\"",
      "packages/plugin-agent-team/references/",
      "Do not create Mission files",
    ],
  },
  {
    dir: "mission-activate",
    required: [
      "name: mission-activate",
      "mexus mission activate",
      "Activated mission: <name>. MissionInboxPipeline will rebuild watchers.",
    ],
  },
  {
    dir: "mission-archive",
    required: [
      "name: mission-archive",
      "mexus mission archive",
      "MissionArchiveBlockedError",
      "Mission has running Panes.",
    ],
  },
  {
    dir: "dispatch",
    required: [
      "name: dispatch",
      "mexus mission active --json",
      "mexus pane list --mission <active> --json",
      "Agent <agent-name> not found in agents.md roster",
      "mission_default_cli_agent",
      "mexus pane create",
    ],
  },
  {
    dir: "mission-agent-add",
    required: [
      "name: mission-agent-add",
      "mexus mission active --json",
      "agent-team/missions/<active>/agents.md",
      "## Agent: <agent-name>",
      "## Agent Names",
      "Does not touch kanban",
    ],
  },
  {
    dir: "mission-agent-remove",
    required: [
      "name: mission-agent-remove",
      "mexus mission active --json",
      "agent-team/missions/<active>/agents.md",
      "## Agent: <agent-name>",
      "mexus pane list --mission <active> --json",
      "Note: Pane <id> still has mission.agentName=<agent-name>; close it via `mexus pane close <id>` if it should not continue receiving Inbox events.",
    ],
  },
  {
    dir: "dispatch-list",
    required: [
      "name: dispatch-list",
      "mexus mission active --json",
      "mexus pane list --mission <active>",
      "Agent | Pane ID | Status | Started | Mission Role",
      "stopped",
      "error",
    ],
  },
];

for (const skill of expectedSkills) {
  const body = readFileSync(join(skillRoot.pathname, skill.dir, "SKILL.md"), "utf8");
  assert.match(body, /^---\n[\s\S]+?\n---\n/, `${skill.dir} must have YAML frontmatter`);
  assert.match(body, /description: .+/, `${skill.dir} must describe the slash command`);
  for (const text of skill.required) {
    assert.ok(body.includes(text), `${skill.dir} missing required text: ${text}`);
  }
}

const createBody = readFileSync(join(skillRoot.pathname, "mission-create", "SKILL.md"), "utf8");
for (const forbidden of [
  "mission-template.md",
  "agents-template.md",
  "kanban-template.md",
  "roundtable-template.md",
  "squad-lead-template.md",
  "writeFile",
  "cat >",
]) {
  assert.ok(!createBody.includes(forbidden), `mission-create must not embed skeleton logic: ${forbidden}`);
}
