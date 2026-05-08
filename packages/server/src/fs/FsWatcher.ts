import fs from 'node:fs'
import path from 'node:path'
import watcher, { type AsyncSubscription, type Event } from '@parcel/watcher'
import ignore, { type Ignore } from 'ignore'
import type { FileNode, FileActivity } from '../types.ts'

const BUILTIN_IGNORE_PATTERNS = [
  // VCS / editor
  '.git', '.svn', '.hg', '.idea', '.vscode',
  // Mexus runtime
  '.nexus',
  // JS / TS ecosystem
  'node_modules', '.pnpm', '.yarn', '.npm', '.turbo',
  '.next', '.nuxt', '.svelte-kit', '.astro',
  '.vercel', '.netlify', '.parcel-cache', '.vite',
  '.rollup.cache', '.webpack',
  // Build / output
  'dist', 'build', 'out', '.output', 'coverage', '.nyc_output',
  // Generic caches
  '.cache', 'tmp', '.tmp', 'temp', '.temp', 'logs',
  // Python
  '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache',
  '.tox', '.venv', 'venv', 'env', '.eggs',
  // Rust / Go / Java
  'target', '.gradle', '.mvn',
  // iOS / Android
  'Pods', 'DerivedData', '.xcodeproj', '.build',
  // Examples / fixtures / vendored
  'demo', 'demos', 'example', 'examples',
  'fixtures', '__fixtures__', '__snapshots__',
  'vendor', 'third_party', 'storybook-static',
]

const BUILTIN_IGNORE_FILES = ['.DS_Store', 'Thumbs.db', 'desktop.ini', '.env.local']

export class FsWatcher {
  private projectDir: string
  private subscription: AsyncSubscription | null = null
  private tree: FileNode[] = []
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private listeners = new Set<(tree: FileNode[]) => void>()
  private fileChangeListeners = new Set<(activity: FileActivity) => void>()
  private recentChanges = new Map<string, number>()
  private ig: Ignore = ignore()

  constructor(projectDir: string) {
    this.projectDir = projectDir
  }

  async start(): Promise<void> {
    this.rebuildIgnore()
    this.tree = this.buildTree(this.projectDir, 0)
    this.notifyListeners()

    // @parcel/watcher takes a flat array of glob-like paths to ignore.
    // Builtin names match anywhere in the tree.
    const ignoreGlobs: string[] = [
      ...BUILTIN_IGNORE_PATTERNS.map((d) => `**/${d}`),
      ...BUILTIN_IGNORE_PATTERNS.map((d) => `**/${d}/**`),
      ...BUILTIN_IGNORE_FILES.map((f) => `**/${f}`),
    ]

    try {
      this.subscription = await watcher.subscribe(
        this.projectDir,
        (err, events) => {
          if (err) return
          this.handleEvents(events)
        },
        { ignore: ignoreGlobs },
      )
    } catch {
      // Watcher init failed — tree was built synchronously, just no live updates.
    }
  }

  getTree(): FileNode[] {
    return this.tree
  }

  onTreeChange(callback: (tree: FileNode[]) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  onFileChange(callback: (activity: FileActivity) => void): () => void {
    this.fileChangeListeners.add(callback)
    return () => this.fileChangeListeners.delete(callback)
  }

  async close(): Promise<void> {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    await this.subscription?.unsubscribe().catch(() => {})
    this.subscription = null
  }

  private handleEvents(events: Event[]): void {
    let needsRebuild = false
    for (const e of events) {
      const rel = path.relative(this.projectDir, e.path)
      if (!rel || rel.startsWith('..')) continue
      // Apply user .gitignore / .mexusignore on top of builtin globs.
      if (this.ig.ignores(rel)) continue

      this.emitFileChange(e.type, rel)
      if (e.type === 'create' || e.type === 'delete') needsRebuild = true
    }
    if (needsRebuild) this.scheduleRebuild()
  }

  private emitFileChange(type: Event['type'], relativePath: string): void {
    const basename = path.basename(relativePath)
    if (!/\.\w{1,10}$/.test(basename)) return

    const now = Date.now()
    const lastChange = this.recentChanges.get(relativePath)
    if (lastChange && now - lastChange < 1000) return
    this.recentChanges.set(relativePath, now)
    if (this.recentChanges.size > 200) {
      for (const [key, ts] of this.recentChanges) {
        if (now - ts > 10000) this.recentChanges.delete(key)
      }
    }

    const actionMap = {
      create: 'create' as const,
      update: 'edit' as const,
      delete: 'delete' as const,
    }
    const activity: FileActivity = {
      file: relativePath,
      action: actionMap[type],
      timestamp: now,
    }
    for (const listener of this.fileChangeListeners) listener(activity)
  }

  private scheduleRebuild(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      const newTree = this.buildTree(this.projectDir, 0)
      if (this.treeFingerprint(newTree) === this.treeFingerprint(this.tree)) return
      this.tree = newTree
      this.notifyListeners()
    }, 300)
  }

  private rebuildIgnore(): void {
    const ig = ignore()
    for (const fname of ['.gitignore', '.mexusignore']) {
      try {
        const raw = fs.readFileSync(path.join(this.projectDir, fname), 'utf-8')
        ig.add(raw)
      } catch {
        // missing file — fine
      }
    }
    this.ig = ig
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) listener(this.tree)
  }

  private treeFingerprint(tree: FileNode[]): string {
    const parts: string[] = []
    const walk = (nodes: FileNode[]) => {
      for (const n of nodes) {
        parts.push(n.path)
        if (n.children) walk(n.children)
      }
    }
    walk(tree)
    return parts.join('\n')
  }

  private buildTree(dirPath: string, depth: number): FileNode[] {
    if (depth > 5) return []

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      const nodes: FileNode[] = []

      for (const entry of entries) {
        if (BUILTIN_IGNORE_FILES.includes(entry.name)) continue
        if (BUILTIN_IGNORE_PATTERNS.includes(entry.name)) continue

        const fullPath = path.join(dirPath, entry.name)
        const relativePath = path.relative(this.projectDir, fullPath)
        // Honor .gitignore / .mexusignore when listing.
        if (this.ig.ignores(relativePath)) continue
        if (entry.isDirectory() && this.ig.ignores(relativePath + '/')) continue

        if (entry.isDirectory()) {
          nodes.push({
            name: entry.name,
            path: relativePath,
            type: 'directory',
            children: this.buildTree(fullPath, depth + 1),
          })
        } else if (entry.isFile()) {
          nodes.push({
            name: entry.name,
            path: relativePath,
            type: 'file',
          })
        }
      }

      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })

      return nodes
    } catch {
      return []
    }
  }
}
