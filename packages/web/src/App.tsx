import { useEffect, useState } from 'react'
import { WorkspaceApp } from '@/components/WorkspaceApp'
import { HubApp } from '@/components/HubApp'
import { hubApi } from '@/lib/apiBase'
import { useConnectionStore } from '@/stores/connectionStore'
import type { ConnectionTarget } from '@/types'

type AppMode = 'loading' | 'hub' | 'workspace'

function makeDefaultTarget(): ConnectionTarget {
  return {
    serverId: 'local-current-origin',
    label: window.location.host,
    httpBaseUrl: window.location.origin,
    wsBaseUrl: window.location.origin,
  }
}

export function App() {
  const [mode, setMode] = useState<AppMode>('loading')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(hubApi('/api/hub/status'), { cache: 'no-store' })
        const contentType = res.headers.get('content-type') || ''
        const data = res.ok && contentType.includes('application/json')
          ? await res.json().catch(() => null) as { mode?: string } | null
          : null
        if (!cancelled && data?.mode === 'hub') {
          useConnectionStore.getState().setHubMode(true)
          setMode('hub')
          return
        }
      } catch { /* ignore */ }
      if (!cancelled) {
        useConnectionStore.getState().setHubMode(false)
        setMode('workspace')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  if (mode === 'loading') {
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-secondary)' }}>
        Loading Mexus…
      </div>
    )
  }

  if (mode === 'hub') return <HubApp />
  return <WorkspaceApp target={makeDefaultTarget()} />
}
