import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface RawPtyCaptureOptions {
  enabled: boolean
  dir: string
  paneId?: string
}

export function sanitizeCaptureFilePart(value: string): string {
  const sanitized = value
    .replace(/^\.+/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return sanitized || 'unknown'
}

export class RawPtyCapture {
  private readonly enabled: boolean
  private readonly dir: string
  private readonly paneId?: string
  private warned = false

  constructor(options: RawPtyCaptureOptions) {
    this.enabled = options.enabled
    this.dir = options.dir
    this.paneId = options.paneId
  }

  write(paneId: string, data: string): void {
    if (!this.enabled || data.length === 0) return
    if (this.paneId && this.paneId !== paneId) return

    try {
      fs.mkdirSync(this.dir, { recursive: true })
      fs.appendFileSync(this.getFilePath(paneId), data)
    } catch (error) {
      if (!this.warned) {
        this.warned = true
        console.warn('[PTY] Raw terminal capture failed:', error)
      }
    }
  }

  getFilePath(paneId: string): string {
    return path.join(this.dir, `${sanitizeCaptureFilePart(paneId)}.ansi.log`)
  }
}

export function createRawPtyCaptureFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): RawPtyCapture {
  const enabled = env.MEXUS_TERMINAL_CAPTURE === '1'
  const dir = env.MEXUS_TERMINAL_CAPTURE_DIR || path.join(os.tmpdir(), 'mexus-terminal-capture')
  const paneId = env.MEXUS_TERMINAL_CAPTURE_PANE || undefined

  return new RawPtyCapture({ enabled, dir, paneId })
}
