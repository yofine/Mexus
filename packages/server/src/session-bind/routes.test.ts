import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSessionBindModule, type SessionBindModule } from './index.ts'
import { registerSessionBindRoute } from './routes.ts'

async function makeServer(module: SessionBindModule): Promise<FastifyInstance> {
  const fastify = Fastify()
  registerSessionBindRoute(fastify, module)
  return fastify
}

describe('session-bind routes', () => {
  let module: SessionBindModule
  let server: FastifyInstance

  beforeEach(async () => {
    module = createSessionBindModule({ devEndpoints: true })
    server = await makeServer(module)
  })

  afterEach(async () => {
    await server.close()
  })

  it('binds a pane with a valid one-shot token', async () => {
    const token = module.issueToken('pane-1')

    const response = await server.inject({
      method: 'POST',
      url: '/api/internal/session-bind',
      headers: { 'x-mexus-token': token },
      payload: { paneId: 'pane-1', sessionId: 'sess-xyz', agent: 'claudecode', source: 'startup' },
      remoteAddress: '127.0.0.1',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ok: true })

    const binding = module.sessions.get('pane-1')
    expect(binding).toEqual(expect.objectContaining({
      paneId: 'pane-1',
      sessionId: 'sess-xyz',
      agent: 'claudecode',
      source: 'startup',
    }))
  })

  it('rejects reuse of the same token (one-shot semantics)', async () => {
    const token = module.issueToken('pane-1')
    const payload = { paneId: 'pane-1', sessionId: 'sess-xyz', agent: 'claudecode', source: 'startup' }
    const first = await server.inject({
      method: 'POST',
      url: '/api/internal/session-bind',
      headers: { 'x-mexus-token': token },
      payload,
      remoteAddress: '127.0.0.1',
    })
    expect(first.statusCode).toBe(200)

    const second = await server.inject({
      method: 'POST',
      url: '/api/internal/session-bind',
      headers: { 'x-mexus-token': token },
      payload,
      remoteAddress: '127.0.0.1',
    })
    expect(second.statusCode).toBe(401)
  })

  it('rejects a token issued for a different pane', async () => {
    module.issueToken('pane-1')
    const otherToken = module.issueToken('pane-2')

    const response = await server.inject({
      method: 'POST',
      url: '/api/internal/session-bind',
      headers: { 'x-mexus-token': otherToken },
      payload: { paneId: 'pane-1', sessionId: 'sess-xyz', agent: 'claudecode', source: 'startup' },
      remoteAddress: '127.0.0.1',
    })

    expect(response.statusCode).toBe(401)
    expect(module.sessions.get('pane-1')).toBeUndefined()
  })

  it('rejects missing X-Mexus-Token header', async () => {
    module.issueToken('pane-1')
    const response = await server.inject({
      method: 'POST',
      url: '/api/internal/session-bind',
      payload: { paneId: 'pane-1', sessionId: 'sess-xyz' },
      remoteAddress: '127.0.0.1',
    })
    expect(response.statusCode).toBe(401)
  })

  it('rejects non-local origins', async () => {
    const token = module.issueToken('pane-1')
    const response = await server.inject({
      method: 'POST',
      url: '/api/internal/session-bind',
      headers: { 'x-mexus-token': token },
      payload: { paneId: 'pane-1', sessionId: 'sess-xyz' },
      remoteAddress: '10.0.0.5',
    })
    expect(response.statusCode).toBe(403)
  })

  it('returns 400 for missing paneId or sessionId', async () => {
    const token = module.issueToken('pane-1')
    const missingPane = await server.inject({
      method: 'POST',
      url: '/api/internal/session-bind',
      headers: { 'x-mexus-token': token },
      payload: { sessionId: 'sess' },
      remoteAddress: '127.0.0.1',
    })
    expect(missingPane.statusCode).toBe(400)

    const missingSession = await server.inject({
      method: 'POST',
      url: '/api/internal/session-bind',
      headers: { 'x-mexus-token': token },
      payload: { paneId: 'pane-1' },
      remoteAddress: '127.0.0.1',
    })
    expect(missingSession.statusCode).toBe(400)
  })

  it('dev /state endpoint lists current bindings', async () => {
    const token = module.issueToken('pane-1')
    await server.inject({
      method: 'POST',
      url: '/api/internal/session-bind',
      headers: { 'x-mexus-token': token },
      payload: { paneId: 'pane-1', sessionId: 'sess', agent: 'claudecode', source: 'startup' },
      remoteAddress: '127.0.0.1',
    })

    const state = await server.inject({
      method: 'GET',
      url: '/api/internal/session-bind/state',
      remoteAddress: '127.0.0.1',
    })

    expect(state.statusCode).toBe(200)
    const body = state.json()
    expect(body.bindings).toHaveLength(1)
    expect(body.bindings[0]).toEqual(expect.objectContaining({ paneId: 'pane-1', sessionId: 'sess' }))
    expect(body.pendingTokens).toBe(0)
  })

  it('dev /_issue-token returns a fresh token', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/internal/session-bind/_issue-token',
      payload: { paneId: 'pane-1' },
      remoteAddress: '127.0.0.1',
    })
    expect(response.statusCode).toBe(200)
    const token = response.json().token as string
    expect(token).toMatch(/^[0-9a-f]{48}$/)
    // The freshly issued token must validate for this pane.
    const bind = await server.inject({
      method: 'POST',
      url: '/api/internal/session-bind',
      headers: { 'x-mexus-token': token },
      payload: { paneId: 'pane-1', sessionId: 'sess', agent: 'claudecode', source: 'startup' },
      remoteAddress: '127.0.0.1',
    })
    expect(bind.statusCode).toBe(200)
  })

  it('dev endpoints are absent when devEndpoints is false', async () => {
    const prod = createSessionBindModule({ devEndpoints: false })
    const prodServer = Fastify()
    registerSessionBindRoute(prodServer, prod)
    try {
      const state = await prodServer.inject({
        method: 'GET',
        url: '/api/internal/session-bind/state',
        remoteAddress: '127.0.0.1',
      })
      expect(state.statusCode).toBe(404)
      const issue = await prodServer.inject({
        method: 'POST',
        url: '/api/internal/session-bind/_issue-token',
        payload: { paneId: 'pane-1' },
        remoteAddress: '127.0.0.1',
      })
      expect(issue.statusCode).toBe(404)
    } finally {
      await prodServer.close()
    }
  })
})
