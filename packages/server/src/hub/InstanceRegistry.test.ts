import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  listInstances,
  markStoppedByPort,
  register,
  removeByPort,
  type InstanceRecord,
} from './InstanceRegistry.ts'

function makeTempRegistryDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-hub-registry-'))
}

function withRegistryDir<T>(fn: (dir: string) => T): T {
  const prev = process.env.NEXUS_REGISTRY_DIR
  const dir = makeTempRegistryDir()
  process.env.NEXUS_REGISTRY_DIR = dir
  try {
    return fn(dir)
  } finally {
    if (prev === undefined) delete process.env.NEXUS_REGISTRY_DIR
    else process.env.NEXUS_REGISTRY_DIR = prev
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function makeRecord(overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return {
    pid: 4242,
    port: 7700,
    cwd: '/tmp/demo',
    projectName: 'demo',
    startedAt: Date.now(),
    status: 'running',
    ...overrides,
  }
}

afterEach(() => {
  delete process.env.NEXUS_REGISTRY_DIR
})

describe('InstanceRegistry', () => {
  it('keeps a stopped record after markStoppedByPort', () => withRegistryDir(() => {
    register(makeRecord())

    markStoppedByPort(7700)

    expect(listInstances()).toEqual([
      expect.objectContaining({ port: 7700, status: 'stopped' }),
    ])
  }))

  it('removes only the targeted record', () => withRegistryDir(() => {
    register(makeRecord({ port: 7700, projectName: 'one' }))
    register(makeRecord({ port: 7701, projectName: 'two', pid: 4343 }))

    removeByPort(7700)

    expect(listInstances()).toEqual([
      expect.objectContaining({ port: 7701, projectName: 'two' }),
    ])
  }))
})
