import { create } from 'zustand'
import type { ConversationEvent, PaneState, PaneMeta, PaneStatus, FileNode, FileDiff, FileActivity, FileAction, DepGraph } from '@/types'
import { debugLog, summarizeShells } from '@/lib/debugLog'
import { upsertPaneById } from './paneStoreUtils'

// Simple djb2 hash for review stale detection
function hashString(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return h
}

// Remove reviewed entries whose hunks content has changed
function invalidateStaleReviewed(
  reviewed: Record<string, number>,
  diffs: FileDiff[],
  options?: { removeMissing?: boolean },
): Record<string, number> {
  const removeMissing = options?.removeMissing ?? true
  let changed = false
  const next = { ...reviewed }
  for (const d of diffs) {
    if (d.file in next && next[d.file] !== hashString(d.hunks || '')) {
      delete next[d.file]
      changed = true
    }
  }
  // Also remove entries for files no longer in diffs
  if (removeMissing) {
    const diffFiles = new Set(diffs.map((d) => d.file))
    for (const file of Object.keys(next)) {
      if (!diffFiles.has(file)) {
        delete next[file]
        changed = true
      }
    }
  }
  return changed ? next : reviewed
}

export interface EditorTab {
  id: string
  type: 'file' | 'review' | 'activity' | 'team' | 'replay'
  label: string
  filePath?: string
  paneId?: string   // null/undefined = workspace (shared) review; set = worktree pane review
  pinned?: boolean
  sessionId?: string // for replay tabs
}

export interface ActivityEntry {
  id: string
  paneId: string
  paneName: string
  agent: string
  file: string
  action: FileAction
  timestamp: number
}

let activitySeq = 0

interface WorkspaceStore {
  name: string
  description: string
  projectDir: string
  workspaceLoaded: boolean
  panes: PaneState[]
  activePaneId: string | null
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting'

  // File tree and git diff
  fileTree: FileNode[]
  fileTreeLoaded: boolean
  gitDiffs: FileDiff[]
  gitStagedDiffs: FileDiff[]
  gitBranchInfo: { branch: string; remote?: string; ahead: number; behind: number } | null

  // Per-pane diffs (worktree isolation)
  paneDiffs: Record<string, FileDiff[]>
  diffViewPaneId: string | null // null = show global workspace diffs

  // Activity tracking
  activities: ActivityEntry[]
  paneCurrentFile: Record<string, { file: string; action: FileAction }>

  // Merge results (transient feedback)
  mergeResults: Record<string, { success: boolean; message: string }>
  conversationByPane: Record<string, ConversationEvent[]>

  // Dependency graph
  depGraph: DepGraph | null

  // Review state tracking (transient, not persisted)
  reviewedFiles: Record<string, number>  // file path → hunks hash when marked reviewed

  // Shell terminal instances (separate from agent panes)
  shellPanes: PaneState[]
  activeShellPaneId: string | null

  // Tab system
  tabs: EditorTab[]
  activeTabId: string | null

  // Actions
  setWorkspace: (name: string, description: string, projectDir: string, panes: PaneState[]) => void
  resetWorkspace: () => void
  setPanes: (panes: PaneState[]) => void
  addPane: (pane: PaneState) => void
  removePane: (paneId: string) => void
  renamePane: (paneId: string, name: string) => void
  updatePaneStatus: (paneId: string, status: PaneStatus) => void
  updatePaneMeta: (paneId: string, meta: PaneMeta) => void
  setActivePaneId: (paneId: string | null) => void
  setConnectionStatus: (status: 'connected' | 'disconnected' | 'reconnecting') => void
  setFileTree: (tree: FileNode[]) => void
  setGitDiffs: (diffs: FileDiff[]) => void
  setGitStagedDiffs: (diffs: FileDiff[]) => void
  setGitAllDiffs: (diffs: FileDiff[], staged: FileDiff[]) => void
  setGitBranchInfo: (info: { branch: string; remote?: string; ahead: number; behind: number }) => void
  setPaneDiffs: (paneId: string, diffs: FileDiff[]) => void
  removePaneDiffs: (paneId: string) => void
  setMergeResult: (paneId: string, result: { success: boolean; message: string }) => void
  clearMergeResult: (paneId: string) => void
  applyConversationEvent: (paneId: string, event: ConversationEvent) => void
  setDiffViewPaneId: (paneId: string | null) => void
  setDepGraph: (graph: DepGraph) => void
  toggleFileReviewed: (file: string, hunks: string) => void
  clearReviewedFiles: () => void
  addActivity: (paneId: string, activity: FileActivity) => void
  addFileActivity: (activity: FileActivity) => void
  openFileTab: (path: string) => void
  openReviewTab: (paneId?: string, paneName?: string) => void
  ensureReplayTabPinned: () => void
  openReplayTab: (sessionId?: string) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  addShellPane: (pane: PaneState) => void
  removeShellPane: (paneId: string) => void
  setActiveShellPaneId: (paneId: string | null) => void
}

function getInitialTabs(): EditorTab[] {
  return [
    { id: 'tab:activity', type: 'activity', label: 'Activity', pinned: true },
    { id: 'tab:team', type: 'team', label: 'Team', pinned: true },
    { id: 'review:workspace', type: 'review', label: 'Review', pinned: true },
    { id: 'tab:replay', type: 'replay', label: 'Replay', pinned: true },
  ]
}

function getInitialWorkspaceState(): Omit<WorkspaceStore,
  'setWorkspace' | 'resetWorkspace' | 'setPanes' | 'addPane' | 'removePane' | 'updatePaneStatus' |
  'renamePane' | 'updatePaneMeta' | 'setActivePaneId' | 'setConnectionStatus' | 'setFileTree' | 'setGitDiffs' |
  'setGitStagedDiffs' | 'setGitAllDiffs' | 'setGitBranchInfo' | 'setPaneDiffs' | 'removePaneDiffs' |
  'setMergeResult' | 'clearMergeResult' | 'applyConversationEvent' | 'setDiffViewPaneId' |
  'setDepGraph' | 'toggleFileReviewed' | 'clearReviewedFiles' | 'addActivity' | 'addFileActivity' |
  'openFileTab' | 'openReviewTab' | 'ensureReplayTabPinned' | 'openReplayTab' | 'closeTab' | 'setActiveTab' |
  'addShellPane' | 'removeShellPane' | 'setActiveShellPaneId'
> {
  return {
    name: '',
    description: '',
    projectDir: '',
    workspaceLoaded: false,
    panes: [],
    activePaneId: null,
    connectionStatus: 'disconnected',
    fileTree: [],
    fileTreeLoaded: false,
    gitDiffs: [],
    gitStagedDiffs: [],
    gitBranchInfo: null,
    paneDiffs: {},
    diffViewPaneId: null,
    activities: [],
    paneCurrentFile: {},
    mergeResults: {},
    conversationByPane: {},
    depGraph: null,
    reviewedFiles: {},
    shellPanes: [],
    activeShellPaneId: null,
    tabs: getInitialTabs(),
    activeTabId: 'tab:activity',
  }
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  ...getInitialWorkspaceState(),

  setWorkspace: (name, description, projectDir, panes) =>
    set((state) => {
      const visible = panes.filter((p) => p.agent !== '__shell__')
      const shells = panes.filter((p) => p.agent === '__shell__')
      const conversationByPane = { ...state.conversationByPane }
      for (const pane of visible) {
        conversationByPane[pane.id] = conversationByPane[pane.id] || []
      }
      const nextActiveShellPaneId =
        state.activeShellPaneId && shells.some((pane) => pane.id === state.activeShellPaneId)
          ? state.activeShellPaneId
          : (shells.length > 0 ? shells[shells.length - 1].id : null)
      debugLog('workspace-store', 'setWorkspace', {
        panes: visible.length,
        incomingShells: summarizeShells(shells),
        prevActiveShellPaneId: state.activeShellPaneId,
        nextActiveShellPaneId,
      })
      return {
        name,
        description,
        projectDir,
        workspaceLoaded: true,
        panes: visible,
        shellPanes: shells,
        activeShellPaneId: nextActiveShellPaneId,
        conversationByPane,
        activePaneId: state.activePaneId && visible.some((pane) => pane.id === state.activePaneId)
          ? state.activePaneId
          : null,
      }
    }),

  resetWorkspace: () => set(getInitialWorkspaceState()),

  setPanes: (panes) => set({ panes: panes.filter((p) => p.agent !== '__shell__') }),

  addPane: (pane) =>
    set((state) => {
      if (pane.agent === '__shell__') {
        // Route to shell pane list
        if (state.shellPanes.some((p) => p.id === pane.id)) {
          debugLog('workspace-store', 'addPane:shell-duplicate-ignored', {
            paneId: pane.id,
            name: pane.name,
            shells: summarizeShells(state.shellPanes),
          })
          return state
        }
        const nextShells = [...state.shellPanes, pane]
        const nextActiveShellPaneId = pane.id
        debugLog('workspace-store', 'addPane:shell', {
          paneId: pane.id,
          name: pane.name,
          prevShells: summarizeShells(state.shellPanes),
          nextShells: summarizeShells(nextShells),
          prevActiveShellPaneId: state.activeShellPaneId,
          nextActiveShellPaneId,
        })
        return {
          shellPanes: nextShells,
          activeShellPaneId: nextActiveShellPaneId,
        }
      }
      const panes = upsertPaneById(state.panes, pane)
      return {
        panes,
        conversationByPane: {
          ...state.conversationByPane,
          [pane.id]: state.conversationByPane[pane.id] || [],
        },
        activePaneId: pane.id,
      }
    }),

  removePane: (paneId) =>
    set((state) => {
      // Handle shell pane removal
      if (state.shellPanes.some((p) => p.id === paneId)) {
        const nextShells = state.shellPanes.filter((p) => p.id !== paneId)
        const nextActiveShellPaneId =
          state.activeShellPaneId === paneId
            ? (nextShells.length > 0 ? nextShells[nextShells.length - 1].id : null)
            : state.activeShellPaneId
        debugLog('workspace-store', 'removePane:shell', {
          paneId,
          prevShells: summarizeShells(state.shellPanes),
          nextShells: summarizeShells(nextShells),
          prevActiveShellPaneId: state.activeShellPaneId,
          nextActiveShellPaneId,
        })
        return {
          shellPanes: nextShells,
          activeShellPaneId: nextActiveShellPaneId,
        }
      }
      const { [paneId]: _, ...restPaneDiffs } = state.paneDiffs
      const { [paneId]: __, ...restConversations } = state.conversationByPane
      const reviewTabId = `review:${paneId}`
      const nextTabs = state.tabs.filter((t) => t.id !== reviewTabId)
      let nextActiveTab = state.activeTabId
      if (state.activeTabId === reviewTabId) {
        nextActiveTab = nextTabs.length > 0 ? nextTabs[0].id : null
      }
      return {
        panes: state.panes.filter((p) => p.id !== paneId),
        activePaneId: state.activePaneId === paneId ? null : state.activePaneId,
        paneDiffs: restPaneDiffs,
        conversationByPane: restConversations,
        diffViewPaneId: state.diffViewPaneId === paneId ? null : state.diffViewPaneId,
        tabs: nextTabs,
        activeTabId: nextActiveTab,
      }
    }),

  renamePane: (paneId, name) =>
    set((state) => {
      const shellIdx = state.shellPanes.findIndex((p) => p.id === paneId)
      if (shellIdx !== -1) {
        if (state.shellPanes[shellIdx].name === name) return state
        const shellPanes = state.shellPanes.slice()
        shellPanes[shellIdx] = { ...shellPanes[shellIdx], name }
        return { shellPanes }
      }
      const idx = state.panes.findIndex((p) => p.id === paneId)
      if (idx === -1 || state.panes[idx].name === name) return state
      const panes = state.panes.slice()
      panes[idx] = { ...panes[idx], name }
      return { panes }
    }),

  updatePaneStatus: (paneId, status) =>
    set((state) => {
      const idx = state.panes.findIndex((p) => p.id === paneId)
      if (idx === -1 || state.panes[idx].status === status) return state
      const panes = state.panes.slice()
      panes[idx] = { ...panes[idx], status }
      return { panes }
    }),

  updatePaneMeta: (paneId, meta) =>
    set((state) => {
      const idx = state.panes.findIndex((p) => p.id === paneId)
      if (idx === -1) return state
      const existing = state.panes[idx].meta
      // Skip update if values haven't actually changed
      const hasChange = Object.keys(meta).some(
        (k) => (meta as Record<string, unknown>)[k] !== (existing as Record<string, unknown>)[k]
      )
      if (!hasChange) return state
      const panes = state.panes.slice()
      panes[idx] = { ...panes[idx], meta: { ...existing, ...meta } }
      return { panes }
    }),

  setActivePaneId: (paneId) => set({ activePaneId: paneId }),

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  setFileTree: (fileTree) => set({ fileTree, fileTreeLoaded: true }),

  setGitDiffs: (gitDiffs) =>
    set((state) => {
      // Invalidate reviewed files whose hunks have changed
      const reviewed = invalidateStaleReviewed(state.reviewedFiles, gitDiffs)
      return { gitDiffs, reviewedFiles: reviewed }
    }),

  setGitStagedDiffs: (gitStagedDiffs) => set({ gitStagedDiffs }),

  setGitAllDiffs: (gitDiffs, gitStagedDiffs) =>
    set((state) => {
      const reviewed = invalidateStaleReviewed(state.reviewedFiles, [...gitDiffs, ...gitStagedDiffs])
      return { gitDiffs, gitStagedDiffs, reviewedFiles: reviewed }
    }),

  setGitBranchInfo: (gitBranchInfo) => set({ gitBranchInfo }),

  setPaneDiffs: (paneId, diffs) =>
    set((state) => {
      const reviewed = invalidateStaleReviewed(state.reviewedFiles, diffs, { removeMissing: false })
      return {
        paneDiffs: { ...state.paneDiffs, [paneId]: diffs },
        reviewedFiles: reviewed,
      }
    }),

  removePaneDiffs: (paneId) =>
    set((state) => {
      const { [paneId]: _, ...rest } = state.paneDiffs
      return {
        paneDiffs: rest,
        diffViewPaneId: state.diffViewPaneId === paneId ? null : state.diffViewPaneId,
      }
    }),

  setMergeResult: (paneId, result) =>
    set((state) => ({
      mergeResults: { ...state.mergeResults, [paneId]: result },
    })),

  clearMergeResult: (paneId) =>
    set((state) => {
      const { [paneId]: _, ...rest } = state.mergeResults
      return { mergeResults: rest }
    }),

  applyConversationEvent: (paneId, event) =>
    set((state) => {
      const current = state.conversationByPane[paneId] || []

      // Append text to the last message of the same role
      if (event.type === 'message' && event.append && current.length > 0) {
        const last = current[current.length - 1]
        if (last?.type === 'message' && last.role === event.role) {
          const next = current.slice()
          next[next.length - 1] = {
            ...last,
            messageId: event.messageId || last.messageId,
            text: last.text + event.text,
          }
          return {
            conversationByPane: { ...state.conversationByPane, [paneId]: next },
          }
        }
      }

      // Update existing tool event by toolCallId
      if (event.type === 'tool') {
        const existingIdx = current.findIndex(
          (e) => e.type === 'tool' && e.toolCallId === event.toolCallId,
        )
        if (existingIdx >= 0) {
          const existing = current[existingIdx] as typeof event
          const next = current.slice()
          next[existingIdx] = {
            ...existing,
            status: event.status,
            title: event.title || existing.title,
            text: event.text
              ? (existing.text ? existing.text + event.text : event.text)
              : existing.text,
          }
          return {
            conversationByPane: { ...state.conversationByPane, [paneId]: next },
          }
        }
      }

      return {
        conversationByPane: {
          ...state.conversationByPane,
          [paneId]: [...current, event],
        },
      }
    }),

  setDiffViewPaneId: (diffViewPaneId) => set({ diffViewPaneId }),

  setDepGraph: (depGraph) => set({ depGraph }),

  toggleFileReviewed: (file, hunks) =>
    set((state) => {
      const reviewed = { ...state.reviewedFiles }
      if (file in reviewed) {
        delete reviewed[file]
      } else {
        reviewed[file] = hashString(hunks || '')
      }
      return { reviewedFiles: reviewed }
    }),

  clearReviewedFiles: () => set({ reviewedFiles: {} }),

  addActivity: (paneId, activity) =>
    set((state) => {
      const pane = state.panes.find((p) => p.id === paneId)
      const paneName = pane?.name || 'Workspace'
      const agent = pane?.agent || 'workspace'
      const entry: ActivityEntry = {
        id: `act-${++activitySeq}`,
        paneId: pane?.id || '__workspace__',
        paneName,
        agent,
        file: activity.file,
        action: activity.action,
        timestamp: activity.timestamp,
      }
      // Keep last 100 activities
      const activities = [entry, ...state.activities].slice(0, 100)
      debugLog('workspace-store', 'addActivity', {
        sourcePaneId: paneId,
        storedPaneId: entry.paneId,
        paneFound: Boolean(pane),
        file: activity.file,
        action: activity.action,
        count: activities.length,
      })
      return {
        activities,
        paneCurrentFile: pane
          ? {
              ...state.paneCurrentFile,
              [pane.id]: { file: activity.file, action: activity.action },
            }
          : state.paneCurrentFile,
      }
    }),

  addFileActivity: (activity) =>
    set((state) => {
      // Skip if this file was already tracked by a pane.activity event recently
      const recent = state.activities[0]
      if (recent && recent.file === activity.file && activity.timestamp - recent.timestamp < 2000) {
        return state
      }
      // Try to attribute: find the most recently active (running/waiting) agent
      const activePanes = state.panes.filter(
        (p) => p.status === 'running' || p.status === 'waiting',
      )
      const pane = activePanes.length > 0 ? activePanes[0] : null
      const entry: ActivityEntry = {
        id: `act-${++activitySeq}`,
        paneId: pane?.id || '__workspace__',
        paneName: pane?.name || 'Workspace',
        agent: pane?.agent || 'workspace',
        file: activity.file,
        action: activity.action,
        timestamp: activity.timestamp,
      }
      const activities = [entry, ...state.activities].slice(0, 100)
      debugLog('workspace-store', 'addFileActivity', {
        storedPaneId: entry.paneId,
        file: activity.file,
        action: activity.action,
        count: activities.length,
      })
      return {
        activities,
        paneCurrentFile: pane
          ? { ...state.paneCurrentFile, [pane.id]: { file: activity.file, action: activity.action } }
          : state.paneCurrentFile,
      }
    }),

  openFileTab: (path) =>
    set((state) => {
      const existing = state.tabs.find((t) => t.type === 'file' && t.filePath === path)
      if (existing) {
        return { activeTabId: existing.id }
      }
      const label = path.split('/').pop() || path
      const tab: EditorTab = { id: `file:${path}`, type: 'file', label, filePath: path }
      return { tabs: [...state.tabs, tab], activeTabId: tab.id }
    }),

  openReviewTab: (paneId?: string, paneName?: string) =>
    set((state) => {
      if (!paneId) {
        // Open/focus workspace review tab (always exists as pinned)
        const existing = state.tabs.find((t) => t.id === 'review:workspace')
        if (existing) {
          return { activeTabId: existing.id }
        }
        const tab: EditorTab = { id: 'review:workspace', type: 'review', label: 'Review', pinned: true }
        return { tabs: [tab, ...state.tabs], activeTabId: tab.id }
      }
      // Open/focus a worktree pane review tab
      const tabId = `review:${paneId}`
      const existing = state.tabs.find((t) => t.id === tabId)
      if (existing) {
        return { activeTabId: existing.id }
      }
      const tab: EditorTab = { id: tabId, type: 'review', label: paneName || 'Review', paneId }
      return { tabs: [...state.tabs, tab], activeTabId: tab.id }
    }),

  ensureReplayTabPinned: () =>
    set((state) => {
      const existing = state.tabs.find((t) => t.id === 'tab:replay')
      if (existing) {
        if (existing.pinned && existing.label === 'Replay') return state
        return {
          tabs: state.tabs.map((tab) => (
            tab.id === 'tab:replay'
              ? { ...tab, label: 'Replay', pinned: true }
              : tab
          )),
        }
      }

      const replayTab: EditorTab = { id: 'tab:replay', type: 'replay', label: 'Replay', pinned: true }
      const reviewIndex = state.tabs.findIndex((tab) => tab.id === 'review:workspace')
      if (reviewIndex === -1) return { tabs: [...state.tabs, replayTab] }
      return {
        tabs: [
          ...state.tabs.slice(0, reviewIndex + 1),
          replayTab,
          ...state.tabs.slice(reviewIndex + 1),
        ],
      }
    }),

  openReplayTab: (sessionId?: string) =>
    set((state) => {
      const tabId = sessionId ? `replay:${sessionId}` : 'tab:replay'
      const existing = state.tabs.find((t) => t.id === tabId)
      if (existing) return { activeTabId: existing.id }
      const tab: EditorTab = {
        id: tabId,
        type: 'replay',
        label: sessionId ? 'Replay' : 'Replay History',
        sessionId,
      }
      return { tabs: [...state.tabs, tab], activeTabId: tab.id }
    }),

  closeTab: (tabId) =>
    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId)
      if (tab?.pinned) return state // Cannot close pinned tabs
      const idx = state.tabs.findIndex((t) => t.id === tabId)
      const next = state.tabs.filter((t) => t.id !== tabId)
      let nextActive = state.activeTabId
      if (state.activeTabId === tabId) {
        if (next.length === 0) {
          nextActive = null
        } else if (idx >= next.length) {
          nextActive = next[next.length - 1].id
        } else {
          nextActive = next[idx].id
        }
      }
      return { tabs: next, activeTabId: nextActive }
    }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  addShellPane: (pane) =>
    set((state) => {
      const nextShells = [...state.shellPanes, pane]
      const nextActiveShellPaneId = pane.id
      debugLog('workspace-store', 'addShellPane', {
        paneId: pane.id,
        name: pane.name,
        prevShells: summarizeShells(state.shellPanes),
        nextShells: summarizeShells(nextShells),
        prevActiveShellPaneId: state.activeShellPaneId,
        nextActiveShellPaneId,
      })
      return {
        shellPanes: nextShells,
        activeShellPaneId: nextActiveShellPaneId,
      }
    }),

  removeShellPane: (paneId) =>
    set((state) => {
      const next = state.shellPanes.filter((p) => p.id !== paneId)
      return {
        shellPanes: next,
        activeShellPaneId:
          state.activeShellPaneId === paneId
            ? (next.length > 0 ? next[next.length - 1].id : null)
            : state.activeShellPaneId,
      }
    }),

  setActiveShellPaneId: (paneId) => set({ activeShellPaneId: paneId }),
}))
