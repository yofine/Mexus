---
name: gh-workflow
description: End-to-end GitHub issue workflow — list issues, pick one, implement the fix, commit, push, and reply to the reporter. Use when the user says "handle issues", "work through the issue queue", or "process issue #N end-to-end".
user-invocable: true
allowed-tools:
  - Bash(gh issue list*)
  - Bash(gh issue view*)
  - Bash(gh issue comment*)
  - Bash(gh repo view*)
  - Bash(gh pr view*)
  - Bash(git status*)
  - Bash(git diff*)
  - Bash(git log*)
  - Bash(git branch*)
  - Bash(git add*)
  - Bash(git commit*)
  - Bash(git push*)
  - Bash(git remote*)
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# /gh-workflow — Full Issue → Fix → Reply Loop

Orchestrate the full flow: list → select → implement → commit → push → reply. This skill chains the behaviors of `/gh-issue-list`, `/gh-issue-resolve`, `/gh-push`, and `/gh-issue-reply` but keeps human checkpoints between phases.

Arguments passed: `$ARGUMENTS`.

---

## Parse arguments

- `#N` / `N` / issue URL → skip the selection phase, go straight to that issue
- `auto` → reduce confirmation prompts (still pause before push and before posting comments)
- Filter keywords (`label:bug`, `assignee:@me`, etc.) → forwarded to the list phase
- No args → list open issues and ask the user to pick

## Phases

### Phase 1 — List & Select

If no issue specified:
1. Invoke the behavior of `/gh-issue-list` with the given filters (default: `--state open --limit 30`).
2. Present the list and ask: "Which issue should I handle?" Stop and wait. Do not pick on behalf of the user.

### Phase 2 — Diagnose

1. `gh issue view <N> --json title,body,labels,comments,author`.
2. Classify: bug / feature / question / unclear (same rules as `/gh-issue-resolve`).
3. If **question** → stop Phase 2+, suggest `/gh-issue-reply` only. Do NOT write code.
4. If **unclear** → ask clarifying questions. Stop.
5. Otherwise produce a diagnosis summary (2-4 lines): root cause, affected files, proposed fix. **Pause for user confirmation before touching code** unless `auto` was passed AND the fix is obviously <20 LOC.

### Phase 3 — Implement

Follow `/gh-issue-resolve`'s implementation rules. Minimum-viable change, no unrelated refactor, no unrequested tests. Report file-by-file what changed.

### Phase 4 — Verify

If the repo has an obvious typecheck/lint/test command (from CLAUDE.md or package.json scripts), run the narrowest applicable one. If verification fails, fix or stop and report — never push broken code.

### Phase 5 — Commit & Push

Follow `/gh-push`'s rules:
1. Stage only relevant files (never `git add -A`).
2. Show diff summary + draft commit message. **Pause for confirmation** regardless of `auto` — pushing is a one-way door.
3. Commit with HEREDOC, match repo style, include `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.
4. Push to the current branch. Refuse direct push to `main`/`master` unless the user confirms in-turn.

### Phase 6 — Reply

Follow `/gh-issue-reply`'s rules:
1. Draft a reply that:
   - Acknowledges the report
   - Explains the root cause briefly
   - Lists concrete changes (bullets)
   - Cites the commit sha just pushed
2. Default language: match the issue body's language (Chinese if issue is Chinese, English otherwise). Respect any language hint in `$ARGUMENTS`.
3. **Show draft, confirm, then post** via `gh issue comment`.
4. Return the comment URL.

### Phase 7 — Next

After posting, ask: "Continue to the next issue?"
- Yes → return to Phase 1 with the same filters.
- No → stop with a short summary (issue #, commit sha, comment URL).

## Global safety
- Human checkpoints are mandatory before: Phase 3 (coding), Phase 5 (push), Phase 6 (posting). `auto` relaxes Phase 3 for trivial fixes only; Phases 5 and 6 always require confirmation.
- If any phase fails, stop. Do not compensate by taking destructive actions (no `git reset --hard`, no force-push, no issue close).
- If `gh` is not authenticated: stop at Phase 1, tell the user to run `gh auth login`.
- Never close the issue automatically — that's the reporter's or maintainer's call.
