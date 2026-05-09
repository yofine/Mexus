---
name: dispatch
description: Ensure a real Mission Agent Pane exists for an agent in the active Mission.
argument-hint: <agent-name>
---

# `/dispatch`

Use this skill when the user invokes `/dispatch <agent-name>`.

This command opens Panes only. It does not write kanban, does not decide assignments, and does not execute the target Agent's task inline.

1. Validate that `<agent-name>` is present.
2. Run `mexus mission active --json` and parse the active Mission name from the JSON response. If there is no active Mission, fail with:

   ```text
   No active Mission. Run `/mission-activate <name>` first.
   ```

3. Run `mexus pane list --mission <active> --json`. If any returned Pane has `mission.agentName === <agent-name>`, print:

   ```text
   Pane already exists for <agent-name> (id: <id>, status: <status>). The Mission Inbox pipeline will deliver kanban tasks automatically.
   ```

   Then exit without creating another Pane.

4. Read `agent-team/missions/<active>/agents.md`. Extract the section that begins with `## Agent: <agent-name>` and ends before the next `## Agent:` heading or the end of the file. Within that block, extract the activation prompt. Use a simple section regex or direct Markdown section extraction; do not parse kanban. If the section is missing, fail with:

   ```text
   Agent <agent-name> not found in agents.md roster
   ```

5. Read `.nexus/config.yaml`. If it contains `mission_default_cli_agent`, use that value as `<cli-type>`. If the field is missing or empty, use `claudecode`.
6. Run:

   ```bash
   mexus pane create --name "<agent-name>" --agent <cli-type> --workdir "$PWD" --mission <active> --mission-agent <agent-name> --mission-role mission-agent --task "<extracted-activation-prompt>"
   ```

7. Print the created Pane id. Mention that the Mission Inbox pipeline will deliver matching kanban tasks automatically.
