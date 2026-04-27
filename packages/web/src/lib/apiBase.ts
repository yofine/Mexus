import type { ConnectionTarget } from '@/types'
import { useConnectionStore } from '@/stores/connectionStore'

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function readTargetBase(target?: ConnectionTarget | null): string {
  return trimTrailingSlash(target?.httpBaseUrl || useConnectionStore.getState().activeTarget?.httpBaseUrl || window.location.origin)
}

function readWsBase(target?: ConnectionTarget | null): string {
  const httpBase = trimTrailingSlash(target?.wsBaseUrl || useConnectionStore.getState().activeTarget?.wsBaseUrl || window.location.origin)
  return httpBase.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
}

export function api(path: string, target?: ConnectionTarget | null): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (!path.startsWith('/')) path = '/' + path
  return `${readTargetBase(target)}${path}`
}

export function hubApi(path: string): string {
  if (!path.startsWith('/')) path = '/' + path
  return `${trimTrailingSlash(window.location.origin)}${path}`
}

export function wsUrl(path: string = '/nexus-ws', target?: ConnectionTarget | null): string {
  if (!path.startsWith('/')) path = '/' + path
  return `${readWsBase(target)}${path}`
}
