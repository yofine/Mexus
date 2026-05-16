// Sidecar entry point for the Mexus plugin session-binding flow.
//
// Intentionally has zero coupling to WorkspaceManager / PtyManager /
// statusline parsing. Once we verify end-to-end with a real `claude` CLI,
// the existing statusline → updatePaneConfigSessionId path will be replaced
// with a one-line forward from sessions.set(...) into WorkspaceManager.

import { createSessionStore, type SessionStore, type SessionRecord } from './sessionStore.ts'
import { createTokenStore, type TokenStore } from './tokenStore.ts'

export { injectPluginEnv, resolvePluginDir } from './injectPluginEnv.ts'
export type { PluginEnvPatch, InjectPluginEnvInput } from './injectPluginEnv.ts'
export { registerSessionBindRoute } from './routes.ts'
export type { SessionRecord } from './sessionStore.ts'

export interface SessionBindModule {
  tokens: TokenStore
  sessions: SessionStore
  devEndpoints: boolean
  /** Convenience: issue a token for a pane (server-side callers). */
  issueToken(paneId: string): string
  /** Convenience: enumerate current bindings (server-side callers). */
  listBindings(): SessionRecord[]
}

export interface CreateSessionBindOptions {
  /**
   * When true, registers `GET /state` and `POST /_issue-token` dev helpers.
   * Used by the verify-session-bind E2E script and local debugging.
   * Default: false.
   */
  devEndpoints?: boolean
}

export function createSessionBindModule(
  options: CreateSessionBindOptions = {},
): SessionBindModule {
  const tokens = createTokenStore()
  const sessions = createSessionStore()
  return {
    tokens,
    sessions,
    devEndpoints: options.devEndpoints === true,
    issueToken(paneId) {
      return tokens.issue(paneId)
    },
    listBindings() {
      return sessions.list()
    },
  }
}
