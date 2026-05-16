import path from 'node:path'
import { simpleGit, type SimpleGit } from 'simple-git'
import watcher, { type AsyncSubscription } from '@parcel/watcher'
import type { FileDiff } from '../types.ts'

export interface GitDiffResult {
  unstaged: FileDiff[]
  staged: FileDiff[]
}

export class GitService {
  private git: SimpleGit
  private projectDir: string
  private gitWatcher: AsyncSubscription | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private workDebounceTimer: ReturnType<typeof setTimeout> | null = null
  private listeners = new Set<(result: GitDiffResult) => void>()
  private currentResult: GitDiffResult = { unstaged: [], staged: [] }
  // Number of WS clients with the diff panel open. When 0, scheduled refreshes
  // are skipped to keep the terminal channel clean. Forced calls (write ops,
  // explicit git.refresh) bypass this gate.
  private subscriberCount = 0
  private alwaysOn = process.env.NEXUS_GIT_DIFF_ALWAYS_ON === '1'

  constructor(projectDir: string) {
    this.projectDir = projectDir
    this.git = simpleGit(projectDir)
  }

  async start(): Promise<void> {
    const isRepo = await this.git.checkIsRepo()
    if (!isRepo) return

    // Defer the initial refresh until a client actually subscribes. The
    // alwaysOn escape hatch preserves the old behavior for rollback.
    if (this.alwaysOn) await this.refresh({ force: true })

    const scheduleRefresh = () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => {
        this.refresh()
      }, 1000)
    }

    // Watch the .git directory itself — index/HEAD/refs all live here.
    // @parcel/watcher requires a directory; that's fine, .git is small and
    // its events are useful (commits, checkouts, refs/ updates).
    const gitDir = path.join(this.projectDir, '.git')
    try {
      this.gitWatcher = await watcher.subscribe(gitDir, (err) => {
        if (err) return
        scheduleRefresh()
      })
    } catch {
      // .git not watchable (e.g. missing or detached worktree) — refresh
      // is still triggered by FsWatcher → notifyWorkingTreeChange().
    }
  }

  // Called by the upstream FsWatcher whenever a file in the working tree
  // changes. Debounced so a burst of agent writes only triggers one diff.
  notifyWorkingTreeChange(): void {
    if (this.workDebounceTimer) clearTimeout(this.workDebounceTimer)
    this.workDebounceTimer = setTimeout(() => {
      this.refresh()
    }, 1000)
  }

  async refresh(opts: { force?: boolean } = {}): Promise<void> {
    // Skip background refreshes when nobody is watching. Forced calls (write
    // ops, explicit git.refresh) always run so callers can rely on fresh state.
    if (!opts.force && !this.alwaysOn && this.subscriberCount === 0) return
    try {
      const result = await Promise.race([
        this.getDiffs(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('git diff timeout')), 15000)
        ),
      ])
      this.currentResult = result
      this.notifyListeners()
    } catch (err) {
      if ((err as Error).message === 'git diff timeout') {
        console.warn('[GitService] git diff timed out (15s), using cached result')
      }
      // Other git failures also silently use cached result
    }
  }

  // ─── Subscription gating ─────────────────────────────────
  // The WS layer calls these as panels mount/unmount. When the count is
  // non-zero, FsWatcher / .git watcher triggers run refresh() normally.

  addSubscriber(): void {
    this.subscriberCount++
    // First subscriber: kick off a refresh so they see current state quickly.
    if (this.subscriberCount === 1) {
      this.refresh({ force: true }).catch(() => {})
    }
  }

  removeSubscriber(): void {
    if (this.subscriberCount > 0) this.subscriberCount--
  }

  hasSubscribers(): boolean {
    return this.alwaysOn || this.subscriberCount > 0
  }

  getCurrentDiffs(): GitDiffResult {
    return this.currentResult
  }

  onDiffChange(callback: (result: GitDiffResult) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  // ─── Stage / Unstage ─────────────────────────────────────

  async acceptFile(file: string): Promise<void> {
    await this.git.add(file)
    await this.refresh({ force: true })
  }

  async acceptAll(): Promise<void> {
    await this.git.add('-A')
    await this.refresh({ force: true })
  }

  async unstageFile(file: string): Promise<void> {
    await this.git.reset(['HEAD', '--', file])
    await this.refresh({ force: true })
  }

  async unstageAll(): Promise<void> {
    await this.git.reset(['HEAD'])
    await this.refresh({ force: true })
  }

  // ─── Discard ──────────────────────────────────────────────

  async discardFile(file: string): Promise<void> {
    const status = await this.git.status()
    const isUntracked = status.not_added.includes(file) || status.created.includes(file)

    if (isUntracked) {
      const fullPath = path.join(this.projectDir, file)
      const fs = await import('node:fs')
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath)
      }
    } else {
      await this.git.checkout(['--', file])
      try {
        await this.git.reset(['HEAD', '--', file])
      } catch {
        // May not be staged, ignore
      }
    }
    await this.refresh({ force: true })
  }

  async discardAll(): Promise<void> {
    await this.git.checkout(['--', '.'])
    await this.git.clean('f', ['-d'])
    await this.refresh({ force: true })
  }

  // ─── Commit / Push ────────────────────────────────────────

  async commit(message: string): Promise<string> {
    const result = await this.git.commit(message)
    await this.refresh({ force: true })
    const summary = result.summary
    return `${summary.changes} file${summary.changes !== 1 ? 's' : ''}, +${summary.insertions} -${summary.deletions}`
  }

  async push(): Promise<string> {
    await this.git.push()
    await this.refresh({ force: true })
    return 'Pushed successfully'
  }

  async getBranchInfo(): Promise<{ branch: string; remote?: string; ahead: number; behind: number }> {
    const status = await this.git.status()
    return {
      branch: status.current || 'HEAD',
      remote: status.tracking || undefined,
      ahead: status.ahead,
      behind: status.behind,
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────

  async close(): Promise<void> {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    if (this.workDebounceTimer) clearTimeout(this.workDebounceTimer)
    await this.gitWatcher?.unsubscribe().catch(() => {})
    this.gitWatcher = null
  }

  // ─── Internal ─────────────────────────────────────────────

  private async getDiffs(): Promise<GitDiffResult> {
    const status = await this.git.status()
    const unstaged: FileDiff[] = []
    const staged: FileDiff[] = []

    // Get unified diffs
    const [unstagedDiffText, stagedDiffText] = await Promise.all([
      this.git.diff(),
      this.git.diff(['--cached']),
    ])

    const unstagedHunks = this.parseFileDiffs(unstagedDiffText)
    const stagedHunks = this.parseFileDiffs(stagedDiffText)

    const stagedFiles = new Set<string>(status.staged)

    // ─── Unstaged changes ───────────────────────────────────
    for (const file of status.not_added) {
      unstaged.push({ file, status: 'added', hunks: '' })
    }
    for (const file of status.created) {
      if (!stagedFiles.has(file)) {
        unstaged.push({ file, status: 'added', hunks: '' })
      }
    }
    for (const file of status.deleted) {
      if (!stagedFiles.has(file)) {
        unstaged.push({ file, status: 'deleted', hunks: '' })
      }
    }
    for (const file of status.modified) {
      unstaged.push({ file, status: 'modified', hunks: unstagedHunks.get(file) || '' })
    }
    for (const file of status.renamed) {
      if (!stagedFiles.has(file.to)) {
        unstaged.push({ file: file.to, status: 'renamed', hunks: '' })
      }
    }

    // Attach hunks to unstaged entries that don't have them yet
    for (const diff of unstaged) {
      if (!diff.hunks && unstagedHunks.has(diff.file)) {
        diff.hunks = unstagedHunks.get(diff.file)!
      }
    }

    // For untracked/new files without hunks, read file content to generate a synthetic diff.
    for (const diff of unstaged) {
      if (diff.status === 'added' && !diff.hunks) {
        try {
          const fs = await import('node:fs/promises')
          const fullPath = path.join(this.projectDir, diff.file)
          const stat = await fs.stat(fullPath).catch(() => null)
          if (!stat || !stat.isFile()) continue
          if (stat.size > 256 * 1024) {
            diff.hunks = `--- /dev/null\n+++ b/${diff.file}\n@@ -0,0 +0,0 @@\n Binary or large file (${Math.round(stat.size / 1024)}KB)`
            continue
          }
          const content = await fs.readFile(fullPath, 'utf-8')
          const lines = content.split('\n')
          const plusLines = lines.map((line) => `+${line}`).join('\n')
          diff.hunks = `--- /dev/null\n+++ b/${diff.file}\n@@ -0,0 +1,${lines.length} @@\n${plusLines}`
        } catch {
          // Skip unreadable files.
        }
      }
    }

    // ─── Staged changes ─────────────────────────────────────
    // Use status.files for accurate staged file detection
    for (const fileResult of status.files) {
      const indexStatus = fileResult.index
      if (!indexStatus || indexStatus === '?' || indexStatus === ' ') continue

      const file = fileResult.path
      let diffStatus: FileDiff['status'] = 'modified'
      if (indexStatus === 'A') diffStatus = 'added'
      else if (indexStatus === 'D') diffStatus = 'deleted'
      else if (indexStatus === 'R') diffStatus = 'renamed'

      staged.push({
        file,
        status: diffStatus,
        hunks: stagedHunks.get(file) || '',
      })
    }

    return { unstaged, staged }
  }

  private parseFileDiffs(diffText: string): Map<string, string> {
    const result = new Map<string, string>()
    if (!diffText) return result
    const fileSections = diffText.split(/^diff --git /m).filter(Boolean)

    for (const section of fileSections) {
      const headerMatch = section.match(/^a\/(.+?) b\/(.+)/)
      if (!headerMatch) continue
      const filename = headerMatch[2]
      result.set(filename, `diff --git ${section}`)
    }

    return result
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.currentResult)
    }
  }
}
