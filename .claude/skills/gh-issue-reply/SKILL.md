---
name: gh-issue-reply
description: Post a reply comment to a GitHub issue. Use when the user wants to respond to an issue, acknowledge a bug report, or share a fix reference with the reporter.
user-invocable: true
allowed-tools:
  - Bash(gh issue view*)
  - Bash(gh issue comment*)
  - Bash(gh repo view*)
  - Bash(git log*)
  - Bash(git remote*)
  - Read
---

# /gh-issue-reply — Reply to a GitHub Issue

Draft and post a reply to the specified issue. Arguments passed: `$ARGUMENTS`.

---

## Resolve target

Parse `$ARGUMENTS` to find:
- Issue number: `#N`, `N`, or a full URL `https://github.com/OWNER/REPO/issues/N`
- Language hint: `中文` / `zh` / `cn` → Chinese; `en` / `english` → English; default Chinese unless the issue body is English
- Optional commit ref: `commit:<sha>` or a short sha — include it in the reply

If the issue number cannot be determined, ask the user.

## Steps

1. **Fetch context**: `gh issue view <N> --repo <owner/repo> --json title,body,author,state,labels,comments`. Read the body and recent comments so the reply is grounded in what was actually reported.

2. **Correlate with recent work** (only if relevant):
   - If the user referenced a commit, include the sha and its subject line.
   - Otherwise check `git log --oneline -10` for any commit that plausibly fixes the issue. Only cite it if the connection is clear — do not speculate.

3. **Draft the reply** in the requested language. Keep it focused:
   - Open with acknowledgment of the report (one line).
   - State the root cause briefly if known.
   - List the concrete changes (bullet points, max 5).
   - End with a "fixed in `<sha>`" or "will land in next release" line when applicable.
   - Do NOT include emoji unless the user asked for it, except a single closing 🙏 is acceptable.

4. **Confirm before posting**: show the drafted reply to the user and ask for approval unless they explicitly said "just post it" / "直接发".

5. **Post**: `gh issue comment <N> --repo <owner/repo> --body "$(cat <<'EOF'\n<body>\nEOF\n)"`. Use HEREDOC for correct formatting.

6. **Return** the comment URL printed by `gh`.

## Safety
- Never edit or close the issue — only post a new comment.
- Never @-mention users the reporter didn't already mention.
- If the repo isn't authenticated, stop and ask the user to run `gh auth login`.
