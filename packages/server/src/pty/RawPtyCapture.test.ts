import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  RawPtyCapture,
  createRawPtyCaptureFromEnv,
  sanitizeCaptureFilePart,
} from './RawPtyCapture.ts'

const tempDirs: string[] = []

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mexus-raw-capture-test-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('sanitizeCaptureFilePart', () => {
  it('keeps capture file names path-safe', () => {
    expect(sanitizeCaptureFilePart('../pane/a:b')).toBe('pane-a-b')
    expect(sanitizeCaptureFilePart('')).toBe('unknown')
  })
})

describe('RawPtyCapture', () => {
  it('is inert when disabled', () => {
    const dir = makeTempDir()
    const capture = new RawPtyCapture({ enabled: false, dir })

    capture.write('pane-1', 'hello')

    expect(fs.readdirSync(dir)).toEqual([])
  })

  it('writes raw PTY chunks to a per-pane ansi log', () => {
    const dir = makeTempDir()
    const capture = new RawPtyCapture({ enabled: true, dir })

    capture.write('pane-1', 'S001 END\r\n')
    capture.write('pane-1', '\u001b[31mRED\u001b[0m\r\n')

    const log = fs.readFileSync(path.join(dir, 'pane-1.ansi.log'), 'utf8')
    expect(log).toBe('S001 END\r\n\u001b[31mRED\u001b[0m\r\n')
  })

  it('honors a pane filter', () => {
    const dir = makeTempDir()
    const capture = new RawPtyCapture({ enabled: true, dir, paneId: 'pane-a' })

    capture.write('pane-a', 'included')
    capture.write('pane-b', 'excluded')

    expect(fs.readFileSync(path.join(dir, 'pane-a.ansi.log'), 'utf8')).toBe('included')
    expect(fs.existsSync(path.join(dir, 'pane-b.ansi.log'))).toBe(false)
  })
})

describe('createRawPtyCaptureFromEnv', () => {
  it('uses explicit env configuration', () => {
    const dir = makeTempDir()
    const capture = createRawPtyCaptureFromEnv({
      MEXUS_TERMINAL_CAPTURE: '1',
      MEXUS_TERMINAL_CAPTURE_DIR: dir,
      MEXUS_TERMINAL_CAPTURE_PANE: 'pane-x',
    })

    capture.write('pane-y', 'excluded')
    capture.write('pane-x', 'included')

    expect(fs.existsSync(path.join(dir, 'pane-y.ansi.log'))).toBe(false)
    expect(fs.readFileSync(path.join(dir, 'pane-x.ansi.log'), 'utf8')).toBe('included')
  })
})
