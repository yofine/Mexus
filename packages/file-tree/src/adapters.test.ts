import { describe, expect, it } from 'vitest'
import { deriveGitStatus, flattenFileNodes } from './adapters'
import type { FileDiff, FileNode } from './types'

describe('flattenFileNodes', () => {
  it('flattens nested file nodes into stable canonical paths', () => {
    const nodes: FileNode[] = [
      {
        name: 'src',
        path: 'src',
        type: 'directory',
        children: [
          { name: 'App.tsx', path: 'src/App.tsx', type: 'file' },
          {
            name: 'components',
            path: 'src/components',
            type: 'directory',
            children: [
              { name: 'FileTree.tsx', path: 'src/components/FileTree.tsx', type: 'file' },
            ],
          },
        ],
      },
      { name: 'package.json', path: 'package.json', type: 'file' },
    ]

    expect(flattenFileNodes(nodes)).toEqual([
      'src',
      'src/App.tsx',
      'src/components',
      'src/components/FileTree.tsx',
      'package.json',
    ])
  })

  it('skips empty paths while preserving children that have paths', () => {
    const nodes: FileNode[] = [
      {
        name: '',
        path: '',
        type: 'directory',
        children: [{ name: 'README.md', path: 'README.md', type: 'file' }],
      },
    ]

    expect(flattenFileNodes(nodes)).toEqual(['README.md'])
  })
})

describe('deriveGitStatus', () => {
  it('maps unstaged and staged diffs to path-first git statuses', () => {
    const unstaged: FileDiff[] = [
      { file: 'src/App.tsx', status: 'modified' },
      { file: 'src/new.ts', status: 'added' },
      { file: 'src/old.ts', status: 'deleted' },
    ]
    const staged: FileDiff[] = [
      { file: 'src/App.tsx', status: 'modified' },
      { file: 'src/renamed.ts', status: 'renamed' },
    ]

    expect(deriveGitStatus(unstaged, staged)).toEqual({
      'src/App.tsx': 'modified',
      'src/new.ts': 'added',
      'src/old.ts': 'deleted',
      'src/renamed.ts': 'renamed',
    })
  })
})
