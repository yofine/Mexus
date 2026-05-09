---
name: mission-create
description: Open a Squad Lead Pane for a new Agent Team Mission without generating Mission files.
argument-hint: <name> "<request>"
---

# `/mission-create`

Use this skill when the user invokes `/mission-create <name> "<request>"`.

Validate the arguments before running anything:

- `<name>` is required and must match the Mexus Mission name regex: `^[A-Za-z0-9][A-Za-z0-9._-]*$`.
- `<request>` is required. Preserve it exactly enough that the Squad Lead can reason from the user's original intent.

Build one task string for the new Squad Lead Pane:

```text
You are the Squad Lead for new Mission `<name>`.

User original request: `<request>`.

Read the Agent Team workflow and the reference samples under `packages/plugin-agent-team/references/`. Those references define the required Mission file structure, field names, collaboration rules, Inbox Protocol, kanban flow, and Squad Lead prompt style.

Your first job is to clarify Goal, Acceptance, constraints, and roster with the user. After clarification, create the Mission directory under `agent-team/missions/<name>/` and author the five Mission files according to those references. Do not dispatch any Mission Agent until the Mission files are complete and valid.

When the kanban has a task with a `To` field pointing at a specific Agent, your dispatch action is: invoke `/dispatch <agent-name>`. The command will ensure the corresponding Pane exists and receives the task. Do NOT attempt to execute that Agent's task by any other means -- the carrier of a Mission task MUST be a Pane, not a subAgent.

After all Mission files are written, run `mexus mission validate <name>`. If validation passes, run `mexus mission activate <name>`.
```

Then run:

```bash
mexus pane create --name "Squad Lead (<name>)" --agent claudecode --workdir "$PWD" --mission <name> --mission-role squad-lead --mission-agent "Squad Lead" --task "<task string>"
```

After success, print the created Pane id and tell the user to continue Mission drafting in the Squad Lead Pane.

Do not create Mission files from this command. Do not create Mission files before the Squad Lead has clarified the request. Do not embed or copy skeleton Markdown in this command; the Squad Lead reads `packages/plugin-agent-team/references/` and authors the files.
