import { useEffect, useMemo, useRef } from 'react'
import {
  MexusFileTree,
  deriveGitStatus,
  type FileTreeActionHandle,
} from '@mexus/file-tree'
import { useWorkspaceStore } from '@/stores/workspaceStore'

type FileTreeActions = {
  expandAll: () => void
  collapseAll: () => void
}

interface FileTreeProps {
  onActionsReady?: (actions: FileTreeActions) => void
}

export function FileTree({ onActionsReady }: FileTreeProps) {
  const actionRef = useRef<FileTreeActionHandle>(null)
  const fileTree = useWorkspaceStore((s) => s.fileTree)
  const fileTreeLoaded = useWorkspaceStore((s) => s.fileTreeLoaded)
  const tabs = useWorkspaceStore((s) => s.tabs)
  const activeTabId = useWorkspaceStore((s) => s.activeTabId)
  const gitDiffs = useWorkspaceStore((s) => s.gitDiffs)
  const gitStagedDiffs = useWorkspaceStore((s) => s.gitStagedDiffs)
  const openFileTab = useWorkspaceStore((s) => s.openFileTab)

  const activeTab = tabs.find((t) => t.id === activeTabId)
  const activeFilePath = activeTab?.type === 'file' ? activeTab.filePath : undefined
  const gitStatus = useMemo(
    () => deriveGitStatus(gitDiffs, gitStagedDiffs),
    [gitDiffs, gitStagedDiffs],
  )

  useEffect(() => {
    if (!onActionsReady) return
    onActionsReady({
      expandAll: () => actionRef.current?.expandAll(),
      collapseAll: () => actionRef.current?.collapseAll(),
    })
  }, [onActionsReady])

  return (
    <MexusFileTree
      ref={actionRef}
      nodes={fileTree}
      loaded={fileTreeLoaded}
      activePath={activeFilePath}
      gitStatus={gitStatus}
      onOpenFile={openFileTab}
    />
  )
}
