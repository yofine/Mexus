import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import { FileTree as PierreFileTree, useFileTree } from '@pierre/trees/react'
import type { GitStatusEntry } from '@pierre/trees'
import { flattenFileNodes } from './adapters'
import type { FileNode, FileTreeActionHandle, GitStatusByPath } from './types'

export interface MexusFileTreeProps {
  nodes: FileNode[]
  loaded: boolean
  activePath?: string
  gitStatus?: GitStatusByPath
  onOpenFile: (path: string) => void
  className?: string
  style?: CSSProperties
}

const treeUnsafeCss = `
  :host {
    --trees-fg-override: var(--text-secondary, #b6b1a8);
    --trees-border-color-override: var(--border-subtle, #22211f);
    --trees-selected-bg-override: var(--accent-muted, rgba(42, 184, 154, 0.12));
    color: var(--text-secondary, #b6b1a8);
    background: transparent;
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: var(--font-sm, 12px);
  }

  button[data-type='item'] {
    border-radius: var(--radius-sm, 2px);
  }

  button[data-type='item']:hover {
    background: var(--bg-overlay, rgba(255, 255, 255, 0.04));
  }
`

function toGitStatusEntries(gitStatus: GitStatusByPath | undefined): GitStatusEntry[] | undefined {
  if (!gitStatus) return undefined
  return Object.entries(gitStatus).map(([path, status]) => ({ path, status }))
}

export const MexusFileTree = forwardRef<FileTreeActionHandle, MexusFileTreeProps>(
  ({ nodes, loaded, activePath, gitStatus, onOpenFile, className, style }, ref) => {
    const onOpenFileRef = useRef(onOpenFile)
    const paths = useMemo(() => flattenFileNodes(nodes), [nodes])
    const gitStatusEntries = useMemo(() => toGitStatusEntries(gitStatus), [gitStatus])
    const { model } = useFileTree({
      flattenEmptyDirectories: true,
      initialExpansion: 'closed',
      initialExpandedPaths: paths.filter((path) => path.split('/').length <= 2),
      paths,
      presorted: true,
      search: true,
      density: 'compact',
      icons: { set: 'minimal', colored: false },
      gitStatus: gitStatusEntries,
      unsafeCSS: treeUnsafeCss,
      onSelectionChange: (selectedPaths) => {
        const selectedPath = selectedPaths[selectedPaths.length - 1]
        if (!selectedPath) return
        const item = model.getItem(selectedPath)
        if (item && !item.isDirectory()) onOpenFileRef.current(selectedPath)
      },
    })

    useEffect(() => {
      onOpenFileRef.current = onOpenFile
    }, [onOpenFile])

    useEffect(() => {
      model.resetPaths(paths, {
        initialExpandedPaths: paths.filter((path) => path.split('/').length <= 2),
      })
    }, [model, paths])

    useEffect(() => {
      model.setGitStatus(gitStatusEntries)
    }, [model, gitStatusEntries])

    useEffect(() => {
      if (!activePath) return
      const item = model.getItem(activePath)
      if (!item) return
      for (const selectedPath of model.getSelectedPaths()) {
        model.getItem(selectedPath)?.deselect()
      }
      item.select()
      item.focus()
    }, [activePath, model])

    useImperativeHandle(ref, () => ({
      collapseAll: () => {
        for (const path of paths) {
          const item = model.getItem(path)
          if (item && 'collapse' in item) item.collapse()
        }
      },
      expandAll: () => {
        for (const path of paths) {
          const item = model.getItem(path)
          if (item && 'expand' in item) item.expand()
        }
      },
    }), [model, paths])

    if (!loaded) {
      return (
        <div className="file-tree-state">
          <span>Loading workspace files...</span>
          <small>Scanning project structure. This usually takes a moment.</small>
        </div>
      )
    }

    if (nodes.length === 0) {
      return (
        <div className="file-tree-state">
          <span>No files found</span>
          <small>The workspace file tree is empty or all files are ignored.</small>
        </div>
      )
    }

    return (
      <PierreFileTree
        model={model}
        className={className}
        style={{ height: '100%', ...style }}
      />
    )
  },
)

MexusFileTree.displayName = 'MexusFileTree'
