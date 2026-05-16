#!/usr/bin/env tsx
/**
 * End-to-end verification of the session-bind sidecar.
 *
 *  ┌─────────────────────┐  --plugin-dir   ┌────────────────────────┐
 *  │ this script (Node)  │ ──────────────► │ claude (real CLI)      │
 *  │ - boots Fastify     │   env vars      │ - loads mexus-plugin   │
 *  │ - sessionBind module│ ◄────────────── │ - SessionStart POSTs   │
 *  └─────────────────────┘  HTTP /session-bind                       │
 *
 * Two modes:
 *
 *   --dry-run  Boot the Fastify server, issue a token, and POST a fake
 *              bind payload via fetch(). Never invokes `claude`. Safe in any
 *              environment, used for CI smoke-testing the wiring.
 *
 *   (default)  Spawn a real `claude --plugin-dir <mexus-plugin> -p "say only OK"`
 *              with the bind env injected, and wait for the SessionStart hook
 *              to POST. Requires the `claude` CLI on PATH.
 *
 * Usage:
 *   pnpm --filter @nexus/server exec tsx scripts/verify-session-bind.ts --dry-run
 *   pnpm --filter @nexus/server exec tsx scripts/verify-session-bind.ts
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import {
  createSessionBindModule,
  injectPluginEnv,
  registerSessionBindRoute,
  resolvePluginDir,
} from '../src/session-bind/index.ts'

const HERE = path.dirname(fileURLToPath(import.meta.url))

interface Args {
  dryRun: boolean
  port: number
  paneId: string
  debug: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: argv.includes('--dry-run'),
    port: 17700,
    paneId: 'verify-pane-1',
    debug: argv.includes('--debug'),
  }
  const portFlag = argv.indexOf('--port')
  if (portFlag !== -1 && argv[portFlag + 1]) args.port = Number(argv[portFlag + 1])
  const paneFlag = argv.indexOf('--pane')
  if (paneFlag !== -1 && argv[paneFlag + 1]) args.paneId = argv[paneFlag + 1]
  return args
}

async function bootServer(port: number) {
  const fastify = Fastify({ logger: false })
  const module = createSessionBindModule({ devEndpoints: true })
  registerSessionBindRoute(fastify, module)
  await fastify.listen({ port, host: '127.0.0.1' })
  return { fastify, module }
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

function ok(msg: string): void {
  console.log(`✓ ${msg}`)
}

async function runDryRun(args: Args): Promise<void> {
  console.log(`[dry-run] booting Fastify on http://127.0.0.1:${args.port}`)
  const { fastify, module } = await bootServer(args.port)
  try {
    const token = module.issueToken(args.paneId)
    ok(`issued one-shot token (len=${token.length})`)

    const url = `http://127.0.0.1:${args.port}/api/internal/session-bind`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mexus-token': token },
      body: JSON.stringify({
        paneId: args.paneId,
        sessionId: 'fake-session-from-dry-run',
        agent: 'claudecode',
        source: 'startup',
      }),
    })
    if (response.status !== 200) fail(`unexpected status ${response.status}: ${await response.text()}`)
    ok(`POST /session-bind → 200`)

    const reused = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mexus-token': token },
      body: JSON.stringify({ paneId: args.paneId, sessionId: 'whatever', agent: 'claudecode', source: 'startup' }),
    })
    if (reused.status !== 401) fail(`token reuse should be 401, got ${reused.status}`)
    ok(`token reuse → 401`)

    const bindings = module.listBindings()
    if (bindings.length !== 1) fail(`expected 1 binding, got ${bindings.length}`)
    if (bindings[0].sessionId !== 'fake-session-from-dry-run') fail('binding payload mismatch')
    ok(`binding stored: ${JSON.stringify(bindings[0])}`)
  } finally {
    await fastify.close()
  }
}

async function runReal(args: Args): Promise<void> {
  console.log(`[real] booting Fastify on http://127.0.0.1:${args.port}`)
  const { fastify, module } = await bootServer(args.port)

  const cleanup = async () => {
    await fastify.close()
  }

  try {
    const token = module.issueToken(args.paneId)
    const bindUrl = `http://127.0.0.1:${args.port}/api/internal/session-bind`
    const patch = injectPluginEnv({
      paneId: args.paneId,
      agent: 'claudecode',
      bindUrl,
      paneToken: token,
      debug: args.debug,
    })

    console.log(`[real] plugin dir: ${resolvePluginDir()}`)
    console.log(`[real] spawning: claude ${patch.cliArgs.join(' ')} -p "say only OK"`)

    const child = spawn('claude', [...patch.cliArgs, '-p', 'say only OK'], {
      cwd: HERE,
      env: { ...process.env, ...patch.env },
      stdio: ['ignore', 'inherit', 'inherit'],
    })

    const exitPromise = new Promise<number>((resolve) => {
      child.on('exit', (code) => resolve(code ?? -1))
      child.on('error', (err) => {
        console.error(`[real] spawn error: ${err.message}`)
        resolve(-1)
      })
    })

    const timeoutMs = 60_000
    const start = Date.now()
    let bound = false
    while (Date.now() - start < timeoutMs) {
      if (module.listBindings().length > 0) {
        bound = true
        break
      }
      await new Promise((r) => setTimeout(r, 200))
    }

    if (!bound) {
      child.kill('SIGTERM')
      fail(`no bind received within ${timeoutMs}ms — check /tmp/mexus-plugin.log (re-run with --debug)`)
    }

    const binding = module.listBindings()[0]
    ok(`bind received: paneId=${binding.paneId} sessionId=${binding.sessionId} source=${binding.source}`)

    const code = await exitPromise
    ok(`claude exited with code ${code}`)
  } finally {
    await cleanup()
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.dryRun) {
    await runDryRun(args)
  } else {
    await runReal(args)
  }
  console.log('done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
