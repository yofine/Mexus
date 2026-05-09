import { describe, expect, it, vi } from 'vitest'
import { CliError } from './cli/http.ts'
import { runCli } from './cli.ts'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function io() {
  const stdout: string[] = []
  const stderr: string[] = []
  return {
    stdout,
    stderr,
    io: {
      stdout: (text: string) => stdout.push(text),
      stderr: (text: string) => stderr.push(text),
    },
  }
}

describe('CLI pane subcommands', () => {
  it('parses pane create arguments and posts to the Pane REST endpoint', async () => {
    const fetch = vi.fn(async () => jsonResponse({ pane: { id: 'pane-1', name: 'Bael' } }))
    const output = io()

    await runCli({
      argv: [
        'pane',
        'create',
        '--name',
        'Bael',
        '--agent',
        'codex',
        '--workdir',
        'packages/server',
        '--task',
        'Build CLI',
        '--mission',
        'hub-agent-team-mission-mvp',
        '--mission-agent',
        'Bael',
        '--mission-role',
        'mission-agent',
        '--restore',
        'manual',
        '--isolation',
        'shared',
        '--yolo',
      ],
      env: { NEXUS_PORT: '7788' },
      httpClient: { fetch },
      io: output.io,
    })

    expect(fetch).toHaveBeenCalledWith('http://localhost:7788/api/panes', expect.objectContaining({
      method: 'POST',
      body: expect.any(String),
    }))
    const payload = JSON.parse(fetch.mock.calls[0][1]?.body as string)
    expect(payload).toEqual(expect.objectContaining({
      name: 'Bael',
      agent: 'codex',
      workdir: 'packages/server',
      task: 'Build CLI',
      mission: {
        name: 'hub-agent-team-mission-mvp',
        path: 'agent-team/missions/hub-agent-team-mission-mvp',
        role: 'mission-agent',
        agentName: 'Bael',
      },
      restore: 'manual',
      isolation: 'shared',
      yolo: true,
    }))
    expect(output.stdout).toEqual(['Created pane pane-1: Bael'])
  })

  it('lists panes as JSON with a Mission filter', async () => {
    const fetch = vi.fn(async () => jsonResponse({ panes: [{ id: 'pane-1', name: 'Bael' }] }))
    const output = io()

    await runCli({
      argv: ['pane', 'list', '--mission', 'demo', '--json'],
      env: {},
      httpClient: { fetch },
      io: output.io,
    })

    expect(fetch).toHaveBeenCalledWith('http://localhost:7700/api/panes?mission=demo', expect.any(Object))
    expect(JSON.parse(output.stdout[0])).toEqual({ panes: [{ id: 'pane-1', name: 'Bael' }] })
  })
})

describe('CLI mission subcommands', () => {
  it('refuses mission archive without force when Mission panes are running', async () => {
    const fetch = vi.fn(async () => jsonResponse({ panes: [{ id: 'pane-1', status: 'running' }] }))
    const output = io()

    await expect(runCli({
      argv: ['mission', 'archive', 'demo'],
      env: {},
      httpClient: { fetch },
      io: output.io,
    })).rejects.toThrow(CliError)

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('http://localhost:7700/api/panes?mission=demo', expect.any(Object))
  })

  it('archives a Mission with force through the Mission REST endpoint', async () => {
    const fetch = vi.fn(async () => jsonResponse({ name: 'demo', path: 'agent-team/missions/_archived/demo', closedPaneIds: ['pane-1'] }))
    const output = io()

    await runCli({
      argv: ['mission', 'archive', 'demo', '--force'],
      env: {},
      httpClient: { fetch },
      io: output.io,
    })

    expect(fetch).toHaveBeenCalledWith('http://localhost:7700/api/missions/demo/archive', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ force: true }),
    }))
    expect(output.stdout).toEqual(['Archived Mission demo to agent-team/missions/_archived/demo'])
  })

  it('validates Mission files and prints a JSON error report', async () => {
    const fetch = vi.fn(async () => jsonResponse({
      summary: { name: 'broken' },
      files: {
        mission: { exists: true, raw: 'Mission: `broken`' },
        agents: { exists: false, path: 'agents.md', raw: '' },
        kanban: { exists: true, raw: 'not a kanban' },
        roundtable: { exists: true, raw: 'not a roundtable' },
        squadLead: { exists: false, path: 'squad-lead.md', raw: '' },
      },
    }))
    const output = io()

    await expect(runCli({
      argv: ['mission', 'validate', 'broken', '--json'],
      env: {},
      httpClient: { fetch },
      io: output.io,
    })).rejects.toThrow(CliError)

    const report = JSON.parse(output.stdout[0])
    expect(report.ok).toBe(false)
    expect(report.errors).toEqual(expect.arrayContaining([
      'Missing required file: agents.md',
      'Missing required file: squad-lead.md',
    ]))
  })

  it('prints a clear server-not-running message when fetch fails', async () => {
    const fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })

    await expect(runCli({
      argv: ['mission', 'list'],
      env: {},
      httpClient: { fetch },
      io: io().io,
    })).rejects.toThrow(/Mexus server not running - start it with `mexus start`/)
  })
})
