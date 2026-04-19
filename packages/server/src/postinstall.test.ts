import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  collectSpawnHelpers,
  fixNodePtySpawnHelpers,
  resolveNodePtyDirectory,
} from '../../../scripts/postinstall.mjs'

describe('postinstall script', () => {
  it('resolves the real installed node-pty directory from package resolution', () => {
    const packageJsonPath =
      '/Users/example/Library/pnpm/global/5/.pnpm/node-pty@1.1.0/node_modules/node-pty/package.json'

    expect(resolveNodePtyDirectory(() => packageJsonPath)).toBe(
      '/Users/example/Library/pnpm/global/5/.pnpm/node-pty@1.1.0/node_modules/node-pty'
    )
  })

  it('collects helper paths from prebuilds and build outputs', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mexus-postinstall-'))
    const nodePtyDir = path.join(tempDir, 'node-pty')
    const prebuildHelper = path.join(nodePtyDir, 'prebuilds', 'darwin-arm64', 'spawn-helper')
    const buildHelper = path.join(nodePtyDir, 'build', 'Release', 'spawn-helper')

    fs.mkdirSync(path.dirname(prebuildHelper), { recursive: true })
    fs.mkdirSync(path.dirname(buildHelper), { recursive: true })
    fs.writeFileSync(prebuildHelper, '')
    fs.writeFileSync(buildHelper, '')

    expect(collectSpawnHelpers(nodePtyDir).sort()).toEqual([buildHelper, prebuildHelper].sort())
  })

  it('restores execute permission on the resolved helper files', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mexus-postinstall-'))
    const helperPath = path.join(tempDir, 'node-pty', 'prebuilds', 'darwin-arm64', 'spawn-helper')

    fs.mkdirSync(path.dirname(helperPath), { recursive: true })
    fs.writeFileSync(helperPath, '')
    fs.chmodSync(helperPath, 0o644)

    fixNodePtySpawnHelpers(path.join(tempDir, 'node-pty'))

    expect(fs.statSync(helperPath).mode & 0o777).toBe(0o755)
  })
})
