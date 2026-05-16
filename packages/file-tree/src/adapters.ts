import type { FileDiff, FileNode, GitStatusByPath } from './types'

export function flattenFileNodes(nodes: FileNode[]): string[] {
  const paths: string[] = []

  function visit(items: FileNode[]) {
    for (const item of items) {
      if (item.path) paths.push(item.path)
      if (item.children?.length) visit(item.children)
    }
  }

  visit(nodes)
  return paths
}

export function deriveGitStatus(unstaged: FileDiff[], staged: FileDiff[] = []): GitStatusByPath {
  const status: GitStatusByPath = {}

  for (const diff of [...staged, ...unstaged]) {
    status[diff.file] = diff.status
  }

  return status
}
