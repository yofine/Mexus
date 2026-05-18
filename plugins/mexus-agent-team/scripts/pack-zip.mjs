#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

const pluginRoot = path.resolve(new URL('..', import.meta.url).pathname)
const output = path.resolve(pluginRoot, '..', 'mexus-agent-team.zip')
const excludeDirs = new Set(['node_modules', 'dist'])
const excludeFiles = new Set(['tsconfig.tsbuildinfo'])

const files = []
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (excludeDirs.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
    } else if (!excludeFiles.has(entry.name)) {
      files.push(path.relative(pluginRoot, full))
    }
  }
}

walk(pluginRoot)
fs.rmSync(output, { force: true })

const script = [
  'import sys, zipfile',
  'root, output = sys.argv[1], sys.argv[2]',
  'files = sys.argv[3:]',
  'with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as z:',
  '    for rel in files:',
  '        z.write(f"{root}/{rel}", f"mexus-agent-team/{rel}")',
].join('\n')

const result = spawnSync('python3', ['-c', script, pluginRoot, output, ...files], { stdio: 'inherit' })
if (result.status !== 0) process.exit(result.status ?? 1)

const sizeKb = Math.ceil(fs.statSync(output).size / 1024)
console.log(`Created ${output} (${sizeKb}K, ${files.length} files)`)
