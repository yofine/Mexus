/**
 * postinstall script for mexus-cli
 *
 * node-pty ships prebuilt binaries including a `spawn-helper` executable.
 * Package managers can strip execute permissions during publish/install, so
 * `spawn-helper` arrives as 0644. Without +x, pty.spawn() fails with
 * "posix_spawnp failed" on macOS/Linux.
 *
 * This script restores the execute permission for the actual installed copy of
 * node-pty, including pnpm's nested global installation layout.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

function defaultResolveNodePtyPackageJson() {
  const require = createRequire(import.meta.url)
  return require.resolve('node-pty/package.json')
}

export function resolveNodePtyDirectory(resolvePackageJson = defaultResolveNodePtyPackageJson) {
  return path.dirname(resolvePackageJson())
}

export function collectSpawnHelpers(nodePtyDir, filesystem = fs) {
  const helpers = []
  const prebuildsDir = path.join(nodePtyDir, 'prebuilds')

  if (filesystem.existsSync(prebuildsDir)) {
    for (const entry of filesystem.readdirSync(prebuildsDir)) {
      const helper = path.join(prebuildsDir, entry, 'spawn-helper')
      if (filesystem.existsSync(helper)) {
        helpers.push(helper)
      }
    }
  }

  const buildHelper = path.join(nodePtyDir, 'build', 'Release', 'spawn-helper')
  if (filesystem.existsSync(buildHelper)) {
    helpers.push(buildHelper)
  }

  return helpers
}

export function fixNodePtySpawnHelpers(nodePtyDir, filesystem = fs) {
  for (const helper of collectSpawnHelpers(nodePtyDir, filesystem)) {
    try {
      filesystem.chmodSync(helper, 0o755)
    } catch {
      // chmod may fail on unsupported platforms; installation should continue.
    }
  }
}

export function runPostinstall(resolvePackageJson = defaultResolveNodePtyPackageJson, filesystem = fs) {
  try {
    const nodePtyDir = resolveNodePtyDirectory(resolvePackageJson)
    fixNodePtySpawnHelpers(nodePtyDir, filesystem)
  } catch {
    // If node-pty is absent or cannot be resolved, keep install non-fatal.
  }
}

export function shouldRunAsScript(argv1, moduleUrl) {
  if (!argv1) {
    return false
  }

  try {
    return fs.realpathSync(argv1) === fileURLToPath(moduleUrl)
  } catch {
    return path.resolve(argv1) === fileURLToPath(moduleUrl)
  }
}

if (shouldRunAsScript(process.argv[1], import.meta.url)) {
  runPostinstall()
}
