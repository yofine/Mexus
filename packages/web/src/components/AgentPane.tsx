import { useCallback, useEffect, useLayoutEffect, useRef, useState, memo } from 'react'
import {
  Check,
  ChevronRight,
  Pencil,
  GitMerge,
  Pin,
  RotateCcw,
  Square,
  X,
  Play,
} from 'lucide-react'
import { Terminal } from './Terminal'
import { AgentIcon, getPaneColor } from './AgentIcon'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import {
  refitTerminal,
  scrollTerminalToBottom,
  getTerminalDimensions,
  unpauseTerminal,
} from '@/stores/terminalRegistry'
import type { PaneState, ClientEvent } from '@/types'
import { canResumePane, createRestartPaneEvent, getResumeMode } from '@/stores/paneStoreUtils'

interface AgentPaneProps {
  pane: PaneState
  paneIndex: number
  paneColor?: string
  isExpanded: boolean
  isHidden?: boolean
  isPinned?: boolean
  onToggle: () => void
  onTogglePin?: () => void
  send: (event: ClientEvent) => void
}

export const EXPANDED_TERMINAL_SYNC_DELAY_MS = 240
export const EXPANDED_TERMINAL_FINAL_SYNC_DELAY_MS = 520
export const EXPANDED_TERMINAL_SCROLL_SETTLE_DELAYS_MS = [120, 360, 760] as const
export const HIDDEN_TERMINAL_PARKING_WIDTH = '100vw'
export const HIDDEN_TERMINAL_PARKING_HEIGHT = '100vh'

export function syncExpandedTerminalLayout(
  paneId: string,
  send: (event: ClientEvent) => void,
  previousDimensions?: { current: { cols: number; rows: number } | null },
): void {
  refitTerminal(paneId)
  const dims = getTerminalDimensions(paneId)
  if (dims) {
    const previous = previousDimensions?.current
    if (!previous || previous.cols !== dims.cols || previous.rows !== dims.rows) {
      send({ type: 'terminal.resize', paneId, cols: dims.cols, rows: dims.rows })
      if (previousDimensions) {
        previousDimensions.current = dims
      }
    }
  }
  scrollTerminalToBottom(paneId)
}

export function scheduleExpandedTerminalLayoutSync(
  paneId: string,
  send: (event: ClientEvent) => void,
): () => void {
  let disposed = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let finalTimeoutId: ReturnType<typeof setTimeout> | null = null
  const scrollTimeoutIds: Array<ReturnType<typeof setTimeout>> = []
  const lastSentDimensions = { current: null as { cols: number; rows: number } | null }

  const run = () => {
    if (disposed) return
    syncExpandedTerminalLayout(paneId, send, lastSentDimensions)
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(run)
  })

  timeoutId = setTimeout(run, EXPANDED_TERMINAL_SYNC_DELAY_MS)
  finalTimeoutId = setTimeout(run, EXPANDED_TERMINAL_FINAL_SYNC_DELAY_MS)
  for (const delay of EXPANDED_TERMINAL_SCROLL_SETTLE_DELAYS_MS) {
    scrollTimeoutIds.push(setTimeout(() => {
      if (!disposed) {
        scrollTerminalToBottom(paneId)
      }
    }, delay))
  }

  return () => {
    disposed = true
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    if (finalTimeoutId) {
      clearTimeout(finalTimeoutId)
    }
    for (const id of scrollTimeoutIds) {
      clearTimeout(id)
    }
  }
}

export const AgentPane = memo(function AgentPane({ pane, paneIndex, paneColor: paneColorOverride, isExpanded, isHidden = false, isPinned = false, onToggle, onTogglePin, send }: AgentPaneProps) {
  const paneColor = paneColorOverride || getPaneColor(paneIndex)
  const paneDiffs = useWorkspaceStore((s) => s.paneDiffs[pane.id])
  const mergeResult = useWorkspaceStore((s) => s.mergeResults[pane.id])
  const conversation = useWorkspaceStore((s) => s.conversationByPane[pane.id] || [])
  const [isEditingName, setIsEditingName] = useState(false)
  const [draftName, setDraftName] = useState(pane.name)
  const diffCount = paneDiffs?.length ?? 0
  const prevExpandedRef = useRef(isExpanded)

  useLayoutEffect(() => {
    if (!isEditingName) setDraftName(pane.name)
  }, [isEditingName, pane.name])

  // Keep xterm mounted and live. The dedicated terminal runtime will own hidden
  // rendering optimization later; for now responsiveness is more important than
  // pausing hidden output.
  useEffect(() => {
    const wasExpanded = prevExpandedRef.current
    prevExpandedRef.current = isExpanded
    unpauseTerminal(pane.id)

    if (isExpanded && !wasExpanded) {
      // Expanding: sync once after the immediate layout pass and once after the
      // pane height transition settles, otherwise xterm can refresh against an
      // intermediate height and appear blank when switching back.
      return scheduleExpandedTerminalLayoutSync(pane.id, send)
    }
  }, [isExpanded, pane.id, send])

  const handleTerminalData = useCallback(
    (data: string) => {
      send({ type: 'terminal.input', paneId: pane.id, data })
    },
    [pane.id, send],
  )

  const handleTerminalResize = useCallback(
    (cols: number, rows: number) => {
      send({ type: 'terminal.resize', paneId: pane.id, cols, rows })
    },
    [pane.id, send],
  )

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    send({ type: 'pane.close', paneId: pane.id })
  }

  const handleStartRename = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDraftName(pane.name)
    setIsEditingName(true)
  }

  const handleCommitRename = (e?: React.MouseEvent | React.FormEvent) => {
    e?.stopPropagation()
    const nextName = draftName.trim()
    if (!nextName) {
      setDraftName(pane.name)
      setIsEditingName(false)
      return
    }
    if (nextName !== pane.name) {
      send({ type: 'pane.rename', paneId: pane.id, name: nextName })
    }
    setIsEditingName(false)
  }

  const handleCancelRename = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setDraftName(pane.name)
    setIsEditingName(false)
  }

  const handleRestart = (e: React.MouseEvent) => {
    e.stopPropagation()
    send(createRestartPaneEvent(pane.id))
  }

  const handleResume = (e: React.MouseEvent) => {
    e.stopPropagation()
    const sessionId = pane.meta.sessionId || pane.sessionId
    if (!sessionId) return
    send({ type: 'pane.restart', paneId: pane.id, mode: getResumeMode(pane), sessionId })
  }

  const handleMerge = (e: React.MouseEvent) => {
    e.stopPropagation()
    send({ type: 'pane.merge', paneId: pane.id })
  }

  const handleInterrupt = (e: React.MouseEvent) => {
    e.stopPropagation()
    send({ type: 'terminal.input', paneId: pane.id, data: '\u0003' })
  }

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation()
    onTogglePin?.()
  }

  const hasSessionId = canResumePane(pane)
  const previewParts = [
    pane.mission
      ? `${pane.mission.name} / ${pane.mission.role === 'squad-lead' ? 'lead' : 'agent'}${pane.mission.agentName ? ` / ${pane.mission.agentName}` : ''}`
      : null,
    pane.isolation === 'worktree' && pane.branch ? pane.branch.replace('nexus/', '') : null,
    pane.workdir,
  ].filter(Boolean)
  const lastConversationPreview = [...conversation]
    .reverse()
    .find((event) => event.type === 'message' && event.text.trim())
  const conversationPreview = lastConversationPreview?.type === 'message'
    ? lastConversationPreview.text.replace(/\s+/g, ' ').trim()
    : ''
  const taskPreview = pane.task?.replace(/\s+/g, ' ').trim()
  const panePreview = conversationPreview || taskPreview || previewParts.join(' · ')

  return (
    <div
      className={`agent-pane ${isExpanded ? 'agent-pane--expanded' : 'agent-pane--collapsed'} ${isHidden ? 'agent-pane--hidden' : ''}`}
      style={{ '--pane-color': paneColor } as React.CSSProperties}
    >
      {/* Header */}
      <div
        onClick={onToggle}
        className="agent-pane-header"
      >
        <div className="agent-pane-header__main">
          {!isExpanded && (
            <ChevronRight className="agent-pane-expand-icon icon-sm" />
          )}

          <span className="agent-pane-avatar" aria-hidden="true">
            <AgentIcon agent={pane.agent} size={22} />
          </span>

          <div className="agent-pane-copy">
            {isEditingName ? (
              <form
                onSubmit={handleCommitRename}
                onClick={(e) => e.stopPropagation()}
                className="agent-pane-title-form"
              >
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') handleCancelRename()
                  }}
                  autoFocus
                  className="pane-title-input"
                />
                <button type="submit" className="pane-action-btn" title="Save title" data-tooltip="Save title">
                  <Check size={13} />
                </button>
                <button type="button" onClick={handleCancelRename} className="pane-action-btn" title="Cancel title edit" data-tooltip="Cancel title edit">
                  <X size={13} />
                </button>
              </form>
            ) : (
              <span className="agent-pane-title">
                {pane.name}
              </span>
            )}
            {!isExpanded && panePreview && (
              <span className="agent-pane-preview">
                {panePreview}
              </span>
            )}
          </div>

          <div className="agent-pane-actions">
            {!isEditingName && (
              <button
                onClick={handleStartRename}
                title="Edit title"
                data-tooltip="Edit title"
                className="pane-action-btn"
              >
                <Pencil size={13} />
              </button>
            )}
            {/* Merge button — worktree panes with changes */}
            {pane.isolation === 'worktree' && diffCount > 0 && (
              <button
                onClick={handleMerge}
                title={`Merge ${pane.branch || 'branch'} into base branch`}
                data-tooltip={`Merge ${pane.branch || 'branch'} into base branch`}
                className="pane-action-btn"
                style={{ color: 'var(--status-waiting)' }}
              >
                <GitMerge size={13} />
              </button>
            )}
            {/* Resume button — shown when pane is stopped/error or has a session ID */}
            {hasSessionId && (
              <button
                onClick={handleResume}
                title={hasSessionId
                  ? `Resume session ${(pane.meta.sessionId || pane.sessionId || '').slice(0, 12)}`
                  : 'Resume session'}
                data-tooltip={hasSessionId
                  ? `Resume session ${(pane.meta.sessionId || pane.sessionId || '').slice(0, 12)}`
                  : 'Resume session'}
                className="pane-action-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  color: 'var(--accent-primary)',
                }}
              >
                <Play size={13} fill="currentColor" />
              </button>
            )}
            <button
              onClick={handleInterrupt}
              title="Send Ctrl+C (interrupt)"
              data-tooltip="Send Ctrl+C (interrupt)"
              className="pane-action-btn"
            >
              <Square className="icon-sm" style={{ color: 'var(--text-muted)' }} />
            </button>
            <button
              onClick={handleRestart}
              title="Restart (new session)"
              data-tooltip="Restart (new session)"
              className="pane-action-btn"
            >
              <RotateCcw className="icon-sm" style={{ color: 'var(--text-muted)' }} />
            </button>
            <button
              onClick={handleClose}
              title="Close"
              data-tooltip="Close"
              className="pane-action-btn"
            >
              <X className="icon-sm" style={{ color: 'var(--text-muted)' }} />
            </button>
            <button
              onClick={handleTogglePin}
              title={isPinned ? 'Unpin from top' : 'Pin to top'}
              data-tooltip={isPinned ? 'Unpin from top' : 'Pin to top'}
              className={`pane-action-btn ${isPinned ? 'pane-action-btn--active' : ''}`}
            >
              <Pin size={13} fill={isPinned ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

      </div>

      {/* Merge result banner */}
      {mergeResult && (
        <div style={{
          padding: '4px 12px',
          fontSize: 'var(--font-xs)',
          fontFamily: 'var(--font-mono)',
          background: mergeResult.success ? 'color-mix(in srgb, var(--status-running) 15%, transparent)' : 'color-mix(in srgb, var(--status-error) 15%, transparent)',
          color: mergeResult.success ? 'var(--status-running)' : 'var(--status-error)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {mergeResult.success ? '✓' : '✗'} {mergeResult.message}
        </div>
      )}

      {/* Terminal body — always mounted to keep xterm instance alive */}
      <div style={isExpanded ? {
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      } : {
        position: 'fixed',
        top: 0,
        left: 0,
        width: HIDDEN_TERMINAL_PARKING_WIDTH,
        height: HIDDEN_TERMINAL_PARKING_HEIGHT,
        overflow: 'hidden',
        pointerEvents: 'none',
        opacity: 0,
        visibility: 'visible',
      }}>
        <Terminal
          paneId={pane.id}
          visible={isExpanded}
          bufferWhenHidden={false}
          onData={handleTerminalData}
          onResize={handleTerminalResize}
        />
      </div>
    </div>
  )
})
