import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import { FileTree as PierreFileTree, useFileTree } from '@pierre/trees/react'
import type { GitStatusEntry } from '@pierre/trees'
import { collectDirectoryPaths, flattenFileNodes } from './adapters'
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
    color-scheme: dark;
    --mexus-tree-bg: var(--bg-panel, #050505);
    --mexus-tree-bg-header: var(--bg-header, #080807);
    --mexus-tree-bg-hover: var(--accent-subtle, rgba(42, 184, 154, 0.06));
    --mexus-tree-bg-selected: var(--accent-muted, rgba(42, 184, 154, 0.12));
    --mexus-tree-border: var(--border-subtle, #22211f);
    --mexus-tree-border-strong: var(--border-default, #2b2925);
    --mexus-tree-fg: var(--text-secondary, #b6b1a8);
    --mexus-tree-fg-strong: var(--text-primary, #e7e5df);
    --mexus-tree-fg-muted: var(--text-muted, #8d887f);
    --mexus-tree-fg-dim: var(--text-dim, #817d74);
    --mexus-tree-accent: var(--accent-primary, #3ccfab);
    --mexus-tree-accent-text: var(--accent-text, #5dddc0);

    --trees-fg-override: var(--mexus-tree-fg);
    --trees-fg-muted-override: var(--mexus-tree-fg-muted);
    --trees-bg-override: var(--mexus-tree-bg);
    --trees-bg-muted-override: var(--mexus-tree-bg-hover);
    --trees-input-bg-override: var(--mexus-tree-bg-header);
    --trees-search-bg-override: var(--mexus-tree-bg-header);
    --trees-search-fg-override: var(--text-primary, #e7e5df);
    --trees-accent-override: var(--mexus-tree-accent);
    --trees-border-color-override: var(--mexus-tree-border);
    --trees-focus-ring-color-override: var(--mexus-tree-accent);
    --trees-focus-ring-width-override: 1px;
    --trees-focus-ring-offset-override: -1px;
    --trees-font-family-override: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    --trees-font-size-override: var(--font-sm, 12px);
    --trees-font-weight-regular-override: 400;
    --trees-font-weight-semibold-override: 500;
    --trees-border-radius-override: var(--radius-sm, 2px);
    --trees-selected-bg-override: var(--mexus-tree-bg-selected);
    --trees-selected-fg-override: var(--mexus-tree-fg-strong);
    --trees-selected-focused-border-color-override: var(--mexus-tree-accent);
    --trees-file-icon-color: var(--mexus-tree-fg-muted);
    --trees-indent-guide-bg-override: rgba(231, 229, 223, 0.07);
    --trees-scrollbar-thumb-override: rgba(231, 229, 223, 0.18);
    --trees-status-added-override: var(--mexus-tree-accent-text);
    --trees-status-modified-override: #7ec7df;
    --trees-status-renamed-override: #d3bd73;
    --trees-status-untracked-override: var(--mexus-tree-accent-text);
    --trees-status-deleted-override: #d86d6d;
    --trees-git-added-color-override: var(--mexus-tree-accent-text);
    --trees-git-modified-color-override: #7ec7df;
    --trees-git-renamed-color-override: #d3bd73;
    --trees-git-untracked-color-override: var(--mexus-tree-accent-text);
    --trees-git-deleted-color-override: #d86d6d;
    --trees-level-gap-override: 10px;
    --trees-item-padding-x-override: 5px;
    --trees-item-margin-x-override: 0px;
    --trees-item-row-gap-override: 5px;
    --trees-icon-width-override: 14px;
    --trees-padding-inline-override: 8px;
    --trees-scrollbar-gutter-override: 6px;
    --trees-git-lane-width-override: 0px;

    color: var(--mexus-tree-fg);
    background: transparent;
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: var(--font-sm, 12px);
  }

  [data-file-tree-virtualized-wrapper='true'],
  [data-file-tree-virtualized-root='true'] {
    background: var(--mexus-tree-bg);
  }

  [data-file-tree-virtualized-scroll='true'] {
    background: var(--mexus-tree-bg);
    scrollbar-gutter: auto;
  }

  [data-file-tree-search-container] {
    flex: 0 0 auto;
    padding: 10px 10px 8px;
    border-bottom: 1px solid var(--mexus-tree-border);
    background: var(--mexus-tree-bg);
  }

  [data-file-tree-search-input] {
    display: block;
    width: 100%;
    height: 26px;
    margin: 0;
    padding: 0 8px;
    box-sizing: border-box;
    border: 1px solid var(--mexus-tree-border-strong);
    border-radius: var(--radius-sm, 2px);
    background: var(--mexus-tree-bg-header);
    color: var(--mexus-tree-fg-strong);
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 12px;
    outline: none;
  }

  [data-file-tree-search-input]::placeholder {
    color: var(--mexus-tree-fg-dim);
  }

  [data-file-tree-search-input]:focus,
  [data-file-tree-search-input][data-file-tree-search-input-fake-focus='true'] {
    border-color: var(--mexus-tree-accent);
    box-shadow: 0 0 0 2px var(--accent-muted, rgba(42, 184, 154, 0.12));
  }

  button[data-type='item'] {
    width: 100%;
    box-sizing: border-box;
    min-height: 22px;
    color: var(--mexus-tree-fg);
    border: 1px solid transparent;
    border-radius: var(--radius-sm, 2px);
    background: transparent;
    transition:
      background 80ms ease,
      border-color 80ms ease,
      color 80ms ease;
  }

  button[data-type='item']:hover {
    background: var(--mexus-tree-bg-hover);
    color: var(--mexus-tree-fg-strong);
  }

  button[data-type='item'][data-item-focused='true'],
  button[data-type='item']:focus-visible {
    outline: none;
    border-color: rgba(60, 207, 171, 0.45);
  }

  button[data-type='item'][data-item-selected='true'] {
    background: var(--mexus-tree-bg-selected);
    border-color: rgba(60, 207, 171, 0.42);
    color: var(--mexus-tree-fg-strong);
  }

  [data-item-type='folder'] > [data-item-section='content'] {
    color: var(--mexus-tree-fg);
    font-weight: 500;
  }

  [data-item-section='icon'] {
    color: var(--mexus-tree-fg-muted);
  }

  [data-item-section='content'] {
    letter-spacing: 0;
  }

  [data-item-section='git'] {
    display: none;
  }

  [data-item-git-status] > [data-item-section='content'] {
    color: var(--mexus-tree-fg-strong);
  }

  [data-item-git-status='added'] > [data-item-section='content'],
  [data-item-git-status='untracked'] > [data-item-section='content'] {
    color: var(--mexus-tree-accent-text);
  }

  [data-item-git-status='modified'] > [data-item-section='content'] {
    color: #b8d9e2;
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
    const filePathSet = useMemo(() => new Set(paths), [paths])
    const filePathSetRef = useRef(filePathSet)
    const directoryPaths = useMemo(() => collectDirectoryPaths(nodes), [nodes])
    const gitStatusEntries = useMemo(() => toGitStatusEntries(gitStatus), [gitStatus])
    const initialExpandedPaths = useMemo(
      () => directoryPaths.filter((path) => path.split('/').length <= 2),
      [directoryPaths],
    )
    const { model } = useFileTree({
      flattenEmptyDirectories: true,
      initialExpansion: 'closed',
      initialExpandedPaths,
      paths,
      search: true,
      density: 'compact',
      icons: { set: 'minimal', colored: false },
      gitStatus: gitStatusEntries,
      unsafeCSS: treeUnsafeCss,
      onSelectionChange: (selectedPaths) => {
        const selectedPath = selectedPaths[selectedPaths.length - 1]
        if (!selectedPath) return
        if (filePathSetRef.current.has(selectedPath)) onOpenFileRef.current(selectedPath)
      },
    })

    useEffect(() => {
      onOpenFileRef.current = onOpenFile
    }, [onOpenFile])

    useEffect(() => {
      filePathSetRef.current = filePathSet
    }, [filePathSet])

    useEffect(() => {
      model.resetPaths(paths, {
        initialExpandedPaths,
      })
    }, [model, paths, initialExpandedPaths])

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
        for (const path of directoryPaths) {
          const item = model.getItem(path)
          if (item && 'collapse' in item) item.collapse()
        }
      },
      expandAll: () => {
        for (const path of directoryPaths) {
          const item = model.getItem(path)
          if (item && 'expand' in item) item.expand()
        }
      },
    }), [model, directoryPaths])

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
        style={{ display: 'flex', width: '100%', height: '100%', minHeight: 0, ...style }}
      />
    )
  },
)

MexusFileTree.displayName = 'MexusFileTree'
