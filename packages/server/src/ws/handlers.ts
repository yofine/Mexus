import type { WebSocket } from '@fastify/websocket'
import type { ClientEvent, ServerEvent } from '../types.ts'
import type { WorkspaceManager } from '../workspace/WorkspaceManager.ts'
import type { GitService } from '../git/GitService.ts'
import { buildTerminalReplayEvents } from './replay.ts'

export function setupWsHandlers(
  socket: WebSocket,
  workspaceManager: WorkspaceManager,
  gitService?: GitService,
): void {
  const send = (event: ServerEvent) => {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(event))
    }
  }

  // Per-connection git diff subscription state. Defaults to false so a
  // connection with the diff panel closed never receives git.diff pushes —
  // those payloads can stall the same WS that carries terminal traffic.
  let gitSubscribed = false

  // Send initial workspace state
  const state = workspaceManager.getState()
  send({
    type: 'workspace.state',
    state,
  })

  // Replay terminal scrollback for each pane asynchronously with an explicit
  // lifecycle so clients can distinguish historical replay from live output.
  const replayScrollback = async () => {
    for (const pane of state.panes) {
      const scrollback = workspaceManager.getScrollback(pane.id)
      for (const event of buildTerminalReplayEvents(pane.id, scrollback)) {
        if (socket.readyState !== socket.OPEN) return // bail if disconnected
        send(event)
        // Yield to event loop between chunks
        await new Promise<void>((resolve) => setImmediate(resolve))
      }
    }
  }
  replayScrollback().catch(() => { /* socket may have closed */ })

  // Send initial per-pane diffs for worktree panes
  const paneDiffs = workspaceManager.getPaneDiffs()
  for (const [paneId, diffs] of paneDiffs) {
    if (diffs.length > 0) {
      send({ type: 'pane.diff', paneId, diffs })
    }
  }

  // Send initial branch info
  gitService?.getBranchInfo()
    .then((info) => send({ type: 'git.branchInfo', ...info }))
    .catch(() => {})

  // Register event handlers for this client (multi-client safe)
  const cleanup = workspaceManager.onEvents({
    onTerminalData: (paneId, data) => {
      send({ type: 'terminal.output', paneId, data })
    },
    onConversationEvent: (paneId, event) => {
      send({ type: 'conversation.event', paneId, event })
    },
    onPaneStatus: (paneId, status) => {
      send({ type: 'pane.status', paneId, status })
    },
    onPaneMeta: (paneId, meta) => {
      send({ type: 'pane.meta', paneId, meta })
    },
    onPaneAdded: (pane) => {
      send({ type: 'pane.added', pane })
    },
    onPaneRenamed: (paneId, name) => {
      send({ type: 'pane.renamed', paneId, name })
    },
    onPaneRemoved: (paneId) => {
      send({ type: 'pane.removed', paneId })
    },
    onPaneActivity: (paneId, activity) => {
      send({ type: 'pane.activity', paneId, activity })
    },
    onFileActivity: (activity) => {
      send({ type: 'file.activity', activity })
    },
    onPaneDiff: (paneId, diffs) => {
      send({ type: 'pane.diff', paneId, diffs })
    },
    onFileTree: (tree) => {
      send({ type: 'fs.tree', tree })
    },
    onGitDiff: (result) => {
      if (!gitSubscribed) return
      send({ type: 'git.diff', unstaged: result.unstaged, staged: result.staged })
    },
  })

  // Handle incoming messages from client
  socket.on('message', (raw: { toString(): string }) => {
    let event: ClientEvent
    try {
      event = JSON.parse(raw.toString()) as ClientEvent
    } catch {
      return
    }

    switch (event.type) {
      case 'terminal.input':
        try {
          workspaceManager.writeToPane(event.paneId, event.data)
        } catch {
          // Pane may have been closed between events — silently ignore
        }
        break

      case 'terminal.resize':
        try {
          workspaceManager.resizePane(event.paneId, event.cols, event.rows)
        } catch {
          // Pane may have been closed — ignore
        }
        break

      case 'conversation.send':
        workspaceManager.sendConversationToPane(event.paneId, event.text).catch((err) => {
          console.error('conversation.send failed:', err)
        })
        break

      case 'pane.create':
        workspaceManager.createPane(event.config).catch((err) => {
          console.error('pane.create failed:', err)
          send({ type: 'pane.create.failed', message: err instanceof Error ? err.message : String(err) })
        })
        break

      case 'pane.close':
        workspaceManager.closePane(event.paneId).catch((err) => {
          console.error('pane.close failed:', err)
        })
        break

      case 'pane.rename':
        try {
          workspaceManager.renamePane(event.paneId, event.name)
        } catch (err) {
          console.error('pane.rename failed:', err)
        }
        break

      case 'pane.restart':
        workspaceManager.restartPane(event.paneId, event.mode, event.sessionId)
        break

      case 'session.list':
        send({ type: 'session.list', paneId: event.paneId, sessions: workspaceManager.getSessionList(event.paneId) })
        break

      case 'git.refresh':
        gitService?.refresh({ force: true })
        break

      case 'git.subscribe':
        if (!gitSubscribed) {
          gitSubscribed = true
          gitService?.addSubscriber()
          // Backfill the freshly-subscribed client with whatever diff state
          // the server already has, so the panel renders immediately rather
          // than waiting for the next FsWatcher tick.
          const current = gitService?.getCurrentDiffs()
          if (current && (current.unstaged.length > 0 || current.staged.length > 0)) {
            send({ type: 'git.diff', unstaged: current.unstaged, staged: current.staged })
          }
        }
        break

      case 'git.unsubscribe':
        if (gitSubscribed) {
          gitSubscribed = false
          gitService?.removeSubscriber()
        }
        break

      case 'git.accept':
        gitService?.acceptFile(event.file).catch((err) => {
          console.error('git.accept failed:', err)
        })
        break

      case 'git.accept.all':
        gitService?.acceptAll().catch((err) => {
          console.error('git.accept.all failed:', err)
        })
        break

      case 'git.discard':
        gitService?.discardFile(event.file).catch((err) => {
          console.error('git.discard failed:', err)
        })
        break

      case 'git.discard.all':
        gitService?.discardAll().catch((err) => {
          console.error('git.discard.all failed:', err)
        })
        break

      case 'git.unstage':
        gitService?.unstageFile(event.file).catch((err) => {
          console.error('git.unstage failed:', err)
        })
        break

      case 'git.unstage.all':
        gitService?.unstageAll().catch((err) => {
          console.error('git.unstage.all failed:', err)
        })
        break

      case 'git.commit':
        if (gitService) {
          gitService.commit(event.message)
            .then((summary) => {
              send({ type: 'git.result', action: 'commit', success: true, message: summary })
              // Also refresh branch info after commit
              return gitService.getBranchInfo()
            })
            .then((info) => {
              send({ type: 'git.branchInfo', ...info })
            })
            .catch((err) => {
              send({ type: 'git.result', action: 'commit', success: false, message: String(err) })
            })
        }
        break

      case 'git.push':
        if (gitService) {
          gitService.push()
            .then((summary) => {
              send({ type: 'git.result', action: 'push', success: true, message: summary })
              return gitService.getBranchInfo()
            })
            .then((info) => {
              send({ type: 'git.branchInfo', ...info })
            })
            .catch((err) => {
              send({ type: 'git.result', action: 'push', success: false, message: String(err) })
            })
        }
        break

      case 'pane.merge':
        workspaceManager.mergeWorktree(event.paneId)
          .then((result) => {
            send({ type: 'pane.merge.result', paneId: event.paneId, ...result })
            // Refresh global git diff after merge
            gitService?.refresh()
          })
          .catch((err) => {
            send({ type: 'pane.merge.result', paneId: event.paneId, success: false, message: String(err) })
          })
        break

      case 'pane.discard':
        workspaceManager.discardWorktree(event.paneId)
          .then((result) => {
            send({ type: 'pane.merge.result', paneId: event.paneId, ...result })
            gitService?.refresh()
          })
          .catch((err) => {
            send({ type: 'pane.merge.result', paneId: event.paneId, success: false, message: String(err) })
          })
        break

      case 'pane.diff.refresh':
        workspaceManager.refreshPaneDiff(event.paneId)
        break

      case 'workspace.save':
        break

      case 'review.comment': {
        // Send review comment to agent pane as terminal input
        const { paneId: targetPaneId, comment } = event
        const targetPane = workspaceManager.getPanes().find((p) => p.id === targetPaneId)
        if (targetPane && comment.content.trim()) {
          const msg = [
            '',
            `[Review Comment] ${comment.file}:${comment.line}`,
            comment.content.trim(),
            '',
          ].join('\n')
          workspaceManager.writeToPane(targetPaneId, msg + '\n')
        }
        break
      }

      case 'broadcast.send':
      case 'task.dispatch':
        // P2 features — no-op for now
        break
    }
  })

  socket.on('close', () => {
    if (gitSubscribed) {
      gitSubscribed = false
      gitService?.removeSubscriber()
    }
    cleanup()
  })
}
