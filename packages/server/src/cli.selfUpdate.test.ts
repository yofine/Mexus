import { describe, expect, it } from 'vitest'
import { getCliCommandName, getSupportedCommands } from './cli.ts'

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
    expect(getSupportedCommands()).toEqual(['start', 'init', 'status', 'stop', 'help'])
  })
})
