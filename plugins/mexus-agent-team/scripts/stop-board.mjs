#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const rootArgIndex = process.argv.indexOf('--root')
const root = path.resolve(rootArgIndex === -1 ? process.cwd() : process.argv[rootArgIndex + 1] || process.cwd())
const stateFile = path.join(root, '.mexus-agent-team', 'board.json')

if (!fs.existsSync(stateFile)) {
  console.log('No Agent Team board process is known for this project.')
  process.exit(0)
}

const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
if (state.pid) {
  try {
    process.kill(state.pid, 'SIGTERM')
    console.log(`Stopped Agent Team board process ${state.pid}.`)
  } catch {
    console.log(`Board process ${state.pid} is no longer running.`)
  }
}

fs.rmSync(stateFile, { force: true })
