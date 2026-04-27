import { useEffect, useRef, useCallback, useState } from 'react'
import type { ClientEvent, ConnectionTarget, ServerEvent } from '@/types'
import { wsUrl as buildWsUrl } from '@/lib/apiBase'
import { debugLog } from '@/lib/debugLog'

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting'

interface UseWebSocketOptions {
  onMessage: (event: ServerEvent) => void
  target: ConnectionTarget | null
}

export function useWebSocket({ onMessage, target }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>()
  const reconnectDelay = useRef(1000)
  const connectionSeq = useRef(0)
  const onMessageRef = useRef(onMessage)
  const targetRef = useRef(target)
  onMessageRef.current = onMessage
  targetRef.current = target

  const closeSocket = useCallback(() => {
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current)
    reconnectTimeout.current = undefined
    const ws = wsRef.current
    wsRef.current = null
    if (ws) {
      debugLog('ws', 'closeSocket:manual-close', { readyState: ws.readyState, target: targetRef.current?.serverId || null })
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      ws.onerror = null
      ws.close()
    }
  }, [])

  const connect = useCallback(() => {
    const currentTarget = targetRef.current
    if (!currentTarget) {
      closeSocket()
      setStatus('disconnected')
      return
    }

    const url = buildWsUrl('/nexus-ws', currentTarget)
    console.log('[Nexus] Connecting to', url)
    const ws = new WebSocket(url)
    const seq = ++connectionSeq.current
    wsRef.current = ws
    setStatus('reconnecting')
    debugLog('ws', 'connect:start', { seq, serverId: currentTarget.serverId, url })

    const isCurrentSocket = () => (
      wsRef.current === ws &&
      connectionSeq.current === seq &&
      targetRef.current?.serverId === currentTarget.serverId
    )

    ws.onopen = () => {
      if (!isCurrentSocket()) {
        debugLog('ws', 'open:stale-close', { seq, serverId: currentTarget.serverId, activeServerId: targetRef.current?.serverId || null })
        ws.close()
        return
      }
      debugLog('ws', 'open:current', { seq, serverId: currentTarget.serverId })
      setStatus('connected')
      reconnectDelay.current = 1000
    }

    ws.onmessage = (e) => {
      if (!isCurrentSocket()) {
        debugLog('ws', 'message:stale-ignored', { seq, serverId: currentTarget.serverId, activeServerId: targetRef.current?.serverId || null })
        return
      }
      try {
        const event = JSON.parse(e.data) as ServerEvent
        if (event.type !== 'terminal.output') {
          debugLog('ws', 'message:received', { seq, serverId: currentTarget.serverId, type: event.type })
        } else if (event.paneId.startsWith('__shell__')) {
          debugLog('ws', 'message:shell-output', { seq, serverId: currentTarget.serverId, paneId: event.paneId, bytes: event.data.length })
        }
        onMessageRef.current(event)
      } catch (err) {
        debugLog('ws', 'message:parse-failed', { seq, error: err instanceof Error ? err.message : String(err) })
      }
    }

    ws.onclose = () => {
      if (!isCurrentSocket()) {
        debugLog('ws', 'close:stale-ignored', { seq, serverId: currentTarget.serverId, activeServerId: targetRef.current?.serverId || null })
        return
      }
      wsRef.current = null
      if (!targetRef.current) {
        debugLog('ws', 'close:no-target', { seq, serverId: currentTarget.serverId })
        setStatus('disconnected')
        return
      }
      debugLog('ws', 'close:reconnect-scheduled', { seq, serverId: currentTarget.serverId, delay: reconnectDelay.current })
      setStatus('reconnecting')
      reconnectTimeout.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000)
        connect()
      }, reconnectDelay.current)
    }

    ws.onerror = () => {
      if (!isCurrentSocket()) {
        debugLog('ws', 'error:stale-ignored', { seq, serverId: currentTarget.serverId })
        return
      }
      debugLog('ws', 'error:current-close', { seq, serverId: currentTarget.serverId })
      ws.close()
    }
  }, [closeSocket])

  useEffect(() => {
    closeSocket()
    reconnectDelay.current = 1000
    if (!target) {
      setStatus('disconnected')
      return
    }
    connect()
    return closeSocket
  }, [target, connect, closeSocket])

  const send = useCallback((event: ClientEvent) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      debugLog('ws', 'send', {
        type: event.type,
        paneId: 'paneId' in event ? event.paneId : undefined,
        config: event.type === 'pane.create' ? event.config : undefined,
      })
      wsRef.current.send(JSON.stringify(event))
    } else {
      debugLog('ws', 'send:dropped', { type: event.type, readyState: wsRef.current?.readyState ?? null })
      console.warn('[Nexus] WebSocket not connected, dropping event:', event.type)
    }
  }, [])

  return { send, status }
}
