import { describe, expect, it } from 'vitest'
import { createSingleFilePatch } from './patch'

describe('createSingleFilePatch', () => {
  it('keeps a complete git patch unchanged', () => {
    const patch = [
      'diff --git a/src/app.ts b/src/app.ts',
      'index 1111111..2222222 100644',
      '--- a/src/app.ts',
      '+++ b/src/app.ts',
      '@@ -1,2 +1,2 @@',
      ' const value = 1',
      '-old()',
      '+next()',
    ].join('\n')

    expect(createSingleFilePatch({ file: 'src/app.ts', hunks: patch })).toBe(patch)
  })

  it('adds patch headers for synthetic hunks from the server', () => {
    const hunks = [
      '--- /dev/null',
      '+++ b/src/new.ts',
      '@@ -0,0 +1,2 @@',
      '+export const value = 1',
      '+export const next = 2',
    ].join('\n')

    expect(createSingleFilePatch({ file: 'src/new.ts', hunks })).toBe([
      'diff --git a/src/new.ts b/src/new.ts',
      'new file mode 100644',
      hunks,
    ].join('\n'))
  })
})
