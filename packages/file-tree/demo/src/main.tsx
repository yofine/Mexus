import React, { useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  MexusFileTree,
  deriveGitStatus,
  type FileTreeActionHandle,
  type FileDiff,
  type FileNode,
} from '../../src'
import './styles.css'

const fileTree: FileNode[] = [
  {
    name: 'packages',
    path: 'packages',
    type: 'directory',
    children: [
      {
        name: 'file-tree',
        path: 'packages/file-tree',
        type: 'directory',
        children: [
          { name: 'package.json', path: 'packages/file-tree/package.json', type: 'file' },
          { name: 'MexusFileTree.tsx', path: 'packages/file-tree/src/MexusFileTree.tsx', type: 'file' },
          { name: 'adapters.ts', path: 'packages/file-tree/src/adapters.ts', type: 'file' },
          { name: 'adapters.test.ts', path: 'packages/file-tree/src/adapters.test.ts', type: 'file' },
        ],
      },
      {
        name: 'web',
        path: 'packages/web',
        type: 'directory',
        children: [
          { name: 'FileTree.tsx', path: 'packages/web/src/components/FileTree.tsx', type: 'file' },
          { name: 'Layout.tsx', path: 'packages/web/src/components/Layout.tsx', type: 'file' },
          { name: 'workspaceStore.ts', path: 'packages/web/src/stores/workspaceStore.ts', type: 'file' },
        ],
      },
      {
        name: 'server',
        path: 'packages/server',
        type: 'directory',
        children: [
          { name: 'FsWatcher.ts', path: 'packages/server/src/fs/FsWatcher.ts', type: 'file' },
          { name: 'GitService.ts', path: 'packages/server/src/git/GitService.ts', type: 'file' },
        ],
      },
    ],
  },
  {
    name: 'docs',
    path: 'docs',
    type: 'directory',
    children: [
      { name: '2026-05-16-mexus-file-tree-package-design.md', path: 'docs/superpowers/specs/2026-05-16-mexus-file-tree-package-design.md', type: 'file' },
      { name: '2026-05-16-mexus-file-tree-package.md', path: 'docs/superpowers/plans/2026-05-16-mexus-file-tree-package.md', type: 'file' },
    ],
  },
  { name: 'package.json', path: 'package.json', type: 'file' },
  { name: 'pnpm-workspace.yaml', path: 'pnpm-workspace.yaml', type: 'file' },
  { name: 'README.md', path: 'README.md', type: 'file' },
]

const unstagedDiffs: FileDiff[] = [
  { file: 'packages/file-tree/src/MexusFileTree.tsx', status: 'modified' },
  { file: 'packages/file-tree/demo/src/main.tsx', status: 'added' },
  { file: 'packages/web/src/components/FileTree.tsx', status: 'modified' },
]

const stagedDiffs: FileDiff[] = [
  { file: 'docs/superpowers/specs/2026-05-16-mexus-file-tree-package-design.md', status: 'added' },
]

function DemoApp() {
  const actions = useRef<FileTreeActionHandle>(null)
  const [activePath, setActivePath] = useState('packages/file-tree/src/MexusFileTree.tsx')
  const gitStatus = useMemo(() => deriveGitStatus(unstagedDiffs, stagedDiffs), [])

  return (
    <main className="demo-shell">
      <section className="demo-panel demo-summary">
        <div className="demo-kicker">Mexus package demo</div>
        <h1>@mexus/file-tree</h1>
        <p>
          This demo renders the package component directly with mock workspace data, Git status,
          active selection, and the same action handle used by the web shell.
        </p>

        <div className="demo-actions">
          <button type="button" onClick={() => actions.current?.expandAll()}>Expand all</button>
          <button type="button" onClick={() => actions.current?.collapseAll()}>Collapse all</button>
        </div>

        <div className="demo-current">
          <span>Selected file</span>
          <strong>{activePath}</strong>
        </div>
      </section>

      <section className="demo-panel demo-tree-panel">
        <header className="demo-tree-header">
          <span>Files</span>
          <small>mock workspace</small>
        </header>
        <div className="demo-tree-body">
          <MexusFileTree
            ref={actions}
            nodes={fileTree}
            loaded
            activePath={activePath}
            gitStatus={gitStatus}
            onOpenFile={setActivePath}
          />
        </div>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DemoApp />
  </React.StrictMode>,
)
