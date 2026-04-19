---
name: gh-issue-resolve
description: Analyze a GitHub issue and implement the fix in code. Use when the user says "fix issue #N", "implement the ask in this issue", or "handle this bug report". Writes code but does NOT commit or push.
user-invocable: true
allowed-tools:
  - Bash(gh issue view*)
  - Bash(gh repo view*)
  - Bash(git log*)
  - Bash(git diff*)
  - Bash(git status*)
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# /gh-issue-resolve — Implement an Issue

Read the issue, diagnose, and produce a code change. Arguments passed: `$ARGUMENTS`.

---

## Resolve target

Parse `$ARGUMENTS` for the issue number (`#N`, `N`, or full URL). If missing, ask.

## Steps

1. **Load issue**: `gh issue view <N> --repo <owner/repo> --json title,body,labels,comments`. Read the body AND all comments — clarifications usually live in comments.

2. **Classify** the issue into one of:
   - **Bug**: something is broken. Reproduce or trace the stack/path in the repo.
   - **Feature**: a new capability. Clarify scope before writing code.
   - **Question/Discussion**: no code change needed — stop and suggest using `/gh-issue-reply` instead.
   - **Unclear**: ask the user for clarification; do not guess.

3. **Diagnose before coding**:
   - For bugs: locate the relevant files (Grep/Glob), read them, identify the root cause. Report findings in 2-4 lines before changing anything.
   - For features: summarize the intended change and affected files, then pause for user confirmation unless the issue is trivial (< 20 LOC).

4. **Implement**: make the minimum change that fixes the reported behavior. Follow the repo's existing style and CLAUDE.md conventions. Do NOT:
   - Refactor unrelated code
   - Add tests unless the issue asks for them or the repo convention requires them
   - Touch files outside the blast radius of the fix

5. **Verify locally** if feasible: typecheck, lint, or run the specific test. If the repo has no obvious verification command, skip — don't invent one.

6. **Report** to the user:
   - Files changed
   - One-line summary of the fix
   - Suggested next step: "run `/gh-push` to commit and push, then `/gh-issue-reply #N` to notify the reporter" — but do not auto-chain. Let the user drive.

## Safety
- Do NOT commit or push. That's `/gh-push`'s job.
- Do NOT close the issue. The reporter or maintainer does that after verification.
- If the fix requires destructive local operations (deleting files, migrations), pause and confirm.
