import { useCallback, useEffect, useState } from 'react'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useConnectionStore } from '@/stores/connectionStore'
import {
  writeToTerminal,
  writeReplayToTerminal,
  finishTerminalReplay,
  resetTerminalForReplay,
  clearAllHistories,
} from '@/stores/terminalRegistry'
import {
  handleAgentTerminalEvent,
  resetAgentTerminalRuntime,
  setAgentTerminalActivePane,
  getAgentTerminalAdapter,
} from '@/lib/agentTerminalRuntime'
import { Layout } from '@/components/Layout'
import { debugLog, summarizeShells } from '@/lib/debugLog'
import type { ConnectionTarget, ServerEvent } from '@/types'

const PANE_CREATE_FAILED_EVENT = 'nexus-pane-create-failed'

interface WorkspaceAppProps {
  target: ConnectionTarget
  hideHeader?: boolean
  hubMode?: boolean
}

export function WorkspaceApp({ target, hideHeader = false, hubMode = false }: WorkspaceAppProps) {
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace)
  const resetWorkspace = useWorkspaceStore((s) => s.resetWorkspace)
  const addPane = useWorkspaceStore((s) => s.addPane)
  const removePane = useWorkspaceStore((s) => s.removePane)
  const renamePane = useWorkspaceStore((s) => s.renamePane)
  const updatePaneStatus = useWorkspaceStore((s) => s.updatePaneStatus)
  const updatePaneMeta = useWorkspaceStore((s) => s.updatePaneMeta)
  const setConnectionStatus = useWorkspaceStore((s) => s.setConnectionStatus)
  const setFileTree = useWorkspaceStore((s) => s.setFileTree)
  const setGitAllDiffs = useWorkspaceStore((s) => s.setGitAllDiffs)
  const setGitBranchInfo = useWorkspaceStore((s) => s.setGitBranchInfo)
  const setPaneDiffs = useWorkspaceStore((s) => s.setPaneDiffs)
  const addActivity = useWorkspaceStore((s) => s.addActivity)
  const addFileActivity = useWorkspaceStore((s) => s.addFileActivity)
  const setMergeResult = useWorkspaceStore((s) => s.setMergeResult)
  const clearMergeResult = useWorkspaceStore((s) => s.clearMergeResult)
  const applyConversationEvent = useWorkspaceStore((s) => s.applyConversationEvent)
  const ensureReplayTabPinned = useWorkspaceStore((s) => s.ensureReplayTabPinned)
  const activePaneId = useWorkspaceStore((s) => s.activePaneId)
  const workspaceKey = target.serverId
  const [terminalRuntimeKey, setTerminalRuntimeKey] = useState<string | null>(null)

  useEffect(() => {
    debugLog('workspace-app', 'mount-target', { serverId: target.serverId, hubMode, hideHeader })
    useConnectionStore.getState().setActiveTarget(target)
    resetAgentTerminalRuntime(workspaceKey, useWorkspaceStore.getState().activePaneId)
    clearAllHistories()
    resetWorkspace()
    if (hubMode) ensureReplayTabPinned()
    setTerminalRuntimeKey(workspaceKey)
    return () => {
      debugLog('workspace-app', 'unmount-target', { serverId: target.serverId, hubMode })
      resetAgentTerminalRuntime(workspaceKey, null)
      clearAllHistories()
      resetWorkspace()
    }
  }, [target, resetWorkspace, hubMode, ensureReplayTabPinned, workspaceKey])

  useEffect(() => {
    setAgentTerminalActivePane(activePaneId)
  }, [activePaneId])

  const handleMessage = useCallback(
    (event: ServerEvent) => {
      switch (event.type) {
        case 'workspace.state':
          debugLog('workspace-app', 'event:workspace.state', {
            serverId: target.serverId,
            panes: event.state.panes.length,
            shells: summarizeShells(event.state.panes.filter((pane) => pane.agent === '__shell__')),
          })
          setWorkspace(
            event.state.name,
            event.state.description || '',
            event.state.projectDir,
            event.state.panes,
          )
          setConnectionStatus('connected')
          break

        case 'terminal.output':
          if (event.paneId.startsWith('__shell__')) {
            debugLog('workspace-app', 'event:terminal.output:shell', {
              serverId: target.serverId,
              paneId: event.paneId,
              bytes: event.data.length,
            })
          }
          if (event.paneId.startsWith('__shell__')) {
            writeToTerminal(event.paneId, event.data)
            window.dispatchEvent(new CustomEvent('shell-output', { detail: { paneId: event.paneId } }))
          } else {
            handleAgentTerminalEvent(workspaceKey, useWorkspaceStore.getState().activePaneId, event)
          }
          break

        case 'terminal.replay.start':
          if (event.paneId.startsWith('__shell__')) {
            resetTerminalForReplay(event.paneId)
          } else {
            handleAgentTerminalEvent(workspaceKey, useWorkspaceStore.getState().activePaneId, event)
          }
          break

        case 'terminal.replay.chunk':
          if (event.paneId.startsWith('__shell__')) {
            writeReplayToTerminal(event.paneId, event.data)
          } else {
            handleAgentTerminalEvent(workspaceKey, useWorkspaceStore.getState().activePaneId, event)
          }
          break

        case 'terminal.replay.end':
          if (event.paneId.startsWith('__shell__')) {
            finishTerminalReplay(event.paneId)
          } else {
            handleAgentTerminalEvent(workspaceKey, useWorkspaceStore.getState().activePaneId, event)
          }
          break

        case 'conversation.event':
          applyConversationEvent(event.paneId, event.event)
          break

        case 'pane.status':
          updatePaneStatus(event.paneId, event.status)
          break

        case 'pane.meta':
          updatePaneMeta(event.paneId, event.meta)
          break

        case 'pane.added':
          debugLog('workspace-app', 'event:pane.added', {
            serverId: target.serverId,
            paneId: event.pane.id,
            name: event.pane.name,
            agent: event.pane.agent,
          })
          addPane(event.pane)
          break

        case 'pane.create.failed':
          debugLog('workspace-app', 'event:pane.create.failed', { serverId: target.serverId, message: event.message })
          window.dispatchEvent(new CustomEvent(PANE_CREATE_FAILED_EVENT, { detail: { message: event.message } }))
          break

        case 'pane.removed':
          debugLog('workspace-app', 'event:pane.removed', { serverId: target.serverId, paneId: event.paneId })
          if (!event.paneId.startsWith('__shell__')) {
            getAgentTerminalAdapter(workspaceKey, useWorkspaceStore.getState().activePaneId).disposePane(event.paneId)
          }
          removePane(event.paneId)
          break

        case 'pane.renamed':
          debugLog('workspace-app', 'event:pane.renamed', { serverId: target.serverId, paneId: event.paneId, name: event.name })
          renamePane(event.paneId, event.name)
          break

        case 'fs.tree':
          setFileTree(event.tree)
          break

        case 'git.diff':
          setGitAllDiffs(event.unstaged, event.staged || [])
          break

        case 'git.branchInfo':
          setGitBranchInfo({ branch: event.branch, remote: event.remote, ahead: event.ahead, behind: event.behind })
          break

        case 'git.result':
          if (!event.success) {
            console.error(`git.${event.action} failed:`, event.message)
          }
          break

        case 'pane.diff':
          setPaneDiffs(event.paneId, event.diffs)
          break

        case 'pane.activity':
          debugLog('workspace-app', 'event:pane.activity', {
            serverId: target.serverId,
            paneId: event.paneId,
            file: event.activity.file,
            action: event.activity.action,
          })
          addActivity(event.paneId, event.activity)
          break

        case 'file.activity':
          debugLog('workspace-app', 'event:file.activity', {
            serverId: target.serverId,
            file: event.activity.file,
            action: event.activity.action,
          })
          addFileActivity(event.activity)
          break

        case 'pane.merge.result':
          setMergeResult(event.paneId, { success: event.success, message: event.message })
          setTimeout(() => clearMergeResult(event.paneId), 5000)
          break
      }
    },
    [target.serverId, workspaceKey, setWorkspace, addPane, removePane, renamePane, updatePaneStatus, updatePaneMeta, setConnectionStatus, setFileTree, setGitAllDiffs, setGitBranchInfo, setPaneDiffs, addActivity, addFileActivity, setMergeResult, clearMergeResult, applyConversationEvent],
  )

  const { send, status } = useWebSocket({ onMessage: handleMessage, target })

  useEffect(() => {
    debugLog('workspace-app', 'status:update', { serverId: target.serverId, status })
    setConnectionStatus(status)
  }, [target.serverId, status, setConnectionStatus])

  if (terminalRuntimeKey !== workspaceKey) {
    return null
  }

  return <Layout send={send} hideHeader={hideHeader} hubMode={hubMode} />
}
