export interface SingleFilePatchInput {
  file: string
  hunks: string
  status?: 'added' | 'modified' | 'deleted' | 'renamed'
}

function trimTrailingNewlines(value: string): string {
  return value.replace(/\n+$/g, '')
}

export function createSingleFilePatch({ file, hunks, status }: SingleFilePatchInput): string {
  const normalizedHunks = trimTrailingNewlines(hunks)
  if (!normalizedHunks) return ''
  if (normalizedHunks.startsWith('diff --git ')) return normalizedHunks

  const lines = [`diff --git a/${file} b/${file}`]
  if (status === 'added' || normalizedHunks.startsWith('--- /dev/null')) {
    lines.push('new file mode 100644')
  } else if (status === 'deleted' || normalizedHunks.includes('\n+++ /dev/null')) {
    lines.push('deleted file mode 100644')
  }
  lines.push(normalizedHunks)
  return lines.join('\n')
}
