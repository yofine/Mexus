// One-shot bind tokens issued per pane.
//
// The plugin hook (running inside the agent CLI) presents this token in the
// X-Mexus-Token header on its POST. The server consumes the token on the
// first valid call, so a leaked token can never be used twice.
//
// Tokens are paneId-scoped: a token issued for pane A cannot bind pane B,
// even if an attacker on localhost guesses both values.

import crypto from 'node:crypto'

export interface TokenStore {
  issue(paneId: string): string
  consume(paneId: string, token: string): boolean
  clear(paneId: string): void
  size(): number
}

export function createTokenStore(): TokenStore {
  const tokens = new Map<string, string>()

  return {
    issue(paneId) {
      const token = crypto.randomBytes(24).toString('hex')
      tokens.set(paneId, token)
      return token
    },
    consume(paneId, token) {
      const expected = tokens.get(paneId)
      if (!expected || expected !== token) return false
      tokens.delete(paneId)
      return true
    },
    clear(paneId) {
      tokens.delete(paneId)
    },
    size() {
      return tokens.size
    },
  }
}
