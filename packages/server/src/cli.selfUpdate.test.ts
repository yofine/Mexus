import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getCliCommandName, getSupportedCommands, shouldRunMain } from './cli.ts'

describe('getCliCommandName', () => {
  it('uses mexus as the default command name', () => {
    expect(getCliCommandName(undefined)).toBe('mexus')
  })

  it('preserves known command aliases from the invoked binary name', () => {
    expect(getCliCommandName('/usr/local/bin/mexus')).toBe('mexus')
    expect(getCliCommandName('/usr/local/bin/nexus')).toBe('nexus')
  })
})

describe('getSupportedCommands', () => {
  it('only exposes public CLI commands', () => {
    expect(getSupportedCommands()).toEqual(['start', 'init', 'status', 'stop', 'hub', 'help'])
  })
})

describe('shouldRunMain', () => {
  it('treats a symlinked bin path as the cli entrypoint', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mexus-cli-test-'))
    const targetPath = path.join(tempDir, 'cli.mjs')
    const linkPath = path.join(tempDir, 'mexus')

    fs.writeFileSync(targetPath, '#!/usr/bin/env node\n')
    fs.symlinkSync(targetPath, linkPath)

    expect(shouldRunMain(linkPath, pathToFileURL(targetPath).href)).toBe(true)
  })

  it('returns false for unrelated paths', () => {
    const modulePath = fileURLToPath(import.meta.url)
    expect(shouldRunMain('/tmp/not-the-cli', pathToFileURL(modulePath).href)).toBe(false)
  })
})
