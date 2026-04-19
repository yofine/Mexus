---
name: gh-push
description: Commit pending changes (optional) and push the current branch to the remote. Use when the user says "push", "push the code", "commit and push", or "send it up". Includes safety checks for main-branch pushes and force-push.
user-invocable: true
allowed-tools:
  - Bash(git status*)
  - Bash(git diff*)
  - Bash(git log*)
  - Bash(git branch*)
  - Bash(git add*)
  - Bash(git commit*)
  - Bash(git push*)
  - Bash(gh pr view*)
---

# /gh-push — Commit & Push

Push the current branch to the remote, optionally committing staged/unstaged changes first. Arguments passed: `$ARGUMENTS`.

---

## Parse arguments

- `force` / `-f` → force-push (REQUIRES extra confirmation, see Safety below)
- `no-commit` → skip the commit step, push existing commits only
- `message:"..."` → use this commit message instead of drafting one
- Any other text → treat as commit message body

## Steps

1. **Inspect state** (run in parallel):
   - `git status` (no `-uall`)
   - `git diff` (unstaged)
   - `git diff --staged`
   - `git branch --show-current`
   - `git log --oneline -5`

2. **Decide what to commit**:
   - If there are no pending changes and no unpushed commits → nothing to do, tell the user.
   - If there are pending changes and `no-commit` was NOT set → draft a commit.
   - If the user listed specific files in arguments, only stage those. Otherwise stage only files relevant to the described change — never `git add -A` blindly, to avoid pulling in secrets or unrelated work.
   - **Show the user the file list and draft message, then confirm** unless arguments already specified a message.

3. **Commit** (if applicable) using HEREDOC:
   ```
   git commit -m "$(cat <<'EOF'
   <subject>

   <body if needed>

   Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
   EOF
   )"
   ```
   Match the repo's commit-message style (check recent `git log`).

4. **Push**:
   - Default: `git push` (or `git push -u origin <branch>` if upstream not set)
   - Force-push: only if `force` was passed AND the branch is not `main`/`master` AND the user re-confirms in this turn.
   - NEVER `--no-verify`.

5. **After push**:
   - Show `git status` to confirm clean.
   - If a PR exists for the branch (`gh pr view --json url,state`), print its URL.
   - If no PR and the branch isn't main, suggest creating one (but don't do it unprompted).

## Safety
- Pushing to `main`/`master` directly: warn and confirm once before pushing.
- Force-push to `main`/`master`: refuse unless the user explicitly says "force push main, I mean it."
- If the pre-push hook fails, do NOT retry with `--no-verify`. Investigate, report, stop.
- If `git status` shows an uncommitted `.env` / `credentials*` / `*.pem` in the staging candidates, flag it and ask before staging.
