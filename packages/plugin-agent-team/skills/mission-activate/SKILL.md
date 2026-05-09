---
name: mission-activate
description: Activate an existing Agent Team Mission through the Mexus CLI.
argument-hint: <name>
---

# `/mission-activate`

Use this skill when the user invokes `/mission-activate <name>`.

Validate that `<name>` is present. Then run:

```bash
mexus mission activate <name>
```

If the command succeeds, print exactly:

```text
Activated mission: <name>. MissionInboxPipeline will rebuild watchers.
```

If the command fails, show the CLI error and do not claim the Mission was activated.
