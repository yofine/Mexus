export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

export interface FileDiff {
  file: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
}

export type GitStatus = FileDiff['status'] | 'untracked'

export type GitStatusByPath = Record<string, GitStatus>

export interface FileTreeActionHandle {
  collapseAll: () => void
  expandAll: () => void
}
