---
name: gh-issue-list
description: List GitHub issues from the current repository with optional filters. Use when the user asks to see open/closed issues, pending tickets, issues by label/assignee, or triage work.
user-invocable: true
allowed-tools:
  - Bash(gh issue list*)
  - Bash(gh issue view*)
  - Bash(gh repo view*)
  - Bash(git remote*)
---

# /gh-issue-list — Pull GitHub Issue List

List issues from the current repository. Supports filters via `$ARGUMENTS`.

Arguments passed: `$ARGUMENTS`

---

## Steps

1. **Resolve repo**: if not in a git repo or no `origin`, ask the user which repo to use. Otherwise `gh` auto-detects.

2. **Parse `$ARGUMENTS`** for common filters (all optional):
   - `open` / `closed` / `all` → `--state`
   - `label:foo` → `--label foo`
   - `assignee:@me` / `assignee:username` → `--assignee`
   - `author:username` → `--author`
   - `limit:N` → `--limit N` (default 30)
   - bare keywords → `--search "<keywords>"`
   - no args → default to `--state open --limit 30`

3. **Run** `gh issue list` with the composed flags, using `--json number,title,state,labels,author,updatedAt,comments` for structured output.

4. **Render** a compact table to the user:
   ```
   #N  [state]  title                            labels        updated    comments
   ```
   Sort by most recently updated. Cap at the requested limit.

5. If the list is empty, say so plainly — don't fabricate entries.

## Notes
- Do NOT modify any issue. This skill is read-only.
- If the user asks a follow-up like "show me #N," call `gh issue view N` and summarize.
- If `gh` isn't authenticated, tell the user to run `gh auth login` and stop.
