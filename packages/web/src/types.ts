// ─── Pane & Agent Types ─────────────────────────────────────

export type PaneStatus = 'running' | 'waiting' | 'idle' | 'stopped' | 'error'
export type RestoreMode = 'continue' | 'restart' | 'manual' | 'resume'
export type AgentType = 'claudecode' | 'codex' | 'opencode' | 'kimi-cli' | 'qodercli' | '__shell__'
export type IsolationMode = 'shared' | 'worktree'
export type AgentTransport = 'pty' | 'acp'
export type ModelProviderType = '' | 'openai' | 'anthropic'
export type ModelProxyMode = '' | 'openai' | 'anthropic'

export interface PaneMeta {
  model?: string
  contextUsedPct?: number
  costUsd?: number
  sessionId?: string
  cwd?: string
}

export interface PaneMission {
  name: string
  path: string
  role: 'squad-lead' | 'mission-agent'
  agentName?: string
}

export type FileAction = 'read' | 'edit' | 'write' | 'create' | 'delete' | 'bash'

export interface FileActivity {
  file: string
  action: FileAction
  timestamp: number
  diff?: string   // unified diff snapshot captured at the moment of change
}

export interface PaneState {
  id: string
  name: string
  agent: AgentType
  workdir?: string
  task?: string
  mission?: PaneMission
  restore: RestoreMode
  isolation: IsolationMode
  yolo?: boolean
  branch?: string
  worktreePath?: string
  sessionId?: string
  runtime: AgentTransport
  status: PaneStatus
  pid?: number
  meta: PaneMeta
  startedAt?: string
}

export interface WorkspaceState {
  name: string
  description?: string
  projectDir: string
  panes: PaneState[]
}

export interface WorkspaceConfig {
  version: string
  name: string
  description?: string
  active_mission?: string | null
  repository: {
    path: string
    git: boolean
  }
  panes: PaneState[]
}

// ─── WebSocket Protocol ─────────────────────────────────────

// Client → Server
export type ClientEvent =
  | { type: 'terminal.input'; paneId: string; data: string }
  | { type: 'terminal.resize'; paneId: string; cols: number; rows: number }
  | { type: 'conversation.send'; paneId: string; text: string }
  | { type: 'pane.create'; config: PaneCreateConfig }
  | { type: 'pane.close'; paneId: string }
  | { type: 'pane.rename'; paneId: string; name: string }
  | { type: 'pane.restart'; paneId: string; mode: RestoreMode; sessionId?: string }
  | { type: 'broadcast.send'; groupId: string; message: string }
  | { type: 'task.dispatch'; tasks: TaskItem[] }
  | { type: 'review.comment'; paneId: string; comment: ReviewComment }
  | { type: 'git.refresh' }
  | { type: 'git.subscribe' }
  | { type: 'git.unsubscribe' }
  | { type: 'git.accept'; file: string }
  | { type: 'git.accept.all' }
  | { type: 'git.discard'; file: string }
  | { type: 'git.discard.all' }
  | { type: 'git.unstage'; file: string }
  | { type: 'git.unstage.all' }
  | { type: 'git.commit'; message: string }
  | { type: 'git.push' }
  | { type: 'pane.merge'; paneId: string }
  | { type: 'pane.discard'; paneId: string }
  | { type: 'pane.diff.refresh'; paneId: string }
  | { type: 'workspace.save' }
  | { type: 'session.list'; paneId?: string }

// Server → Client
export type ServerEvent =
  | { type: 'terminal.output'; paneId: string; data: string }
  | { type: 'terminal.replay.start'; paneId: string; bytes: number }
  | { type: 'terminal.replay.chunk'; paneId: string; data: string; seq: number }
  | { type: 'terminal.replay.end'; paneId: string; chunks: number }
  | { type: 'conversation.event'; paneId: string; event: ConversationEvent }
  | { type: 'pane.status'; paneId: string; status: PaneStatus }
  | { type: 'pane.meta'; paneId: string; meta: PaneMeta }
  | { type: 'pane.added'; pane: PaneState }
  | { type: 'pane.renamed'; paneId: string; name: string }
  | { type: 'pane.create.failed'; message: string }
  | { type: 'pane.removed'; paneId: string }
  | { type: 'fs.tree'; tree: FileNode[] }
  | { type: 'git.diff'; unstaged: FileDiff[]; staged: FileDiff[] }
  | { type: 'git.result'; action: string; success: boolean; message: string }
  | { type: 'git.branchInfo'; branch: string; remote?: string; ahead: number; behind: number }
  | { type: 'pane.diff'; paneId: string; diffs: FileDiff[] }
  | { type: 'pane.merge.result'; paneId: string; success: boolean; message: string }
  | { type: 'pane.activity'; paneId: string; activity: FileActivity }
  | { type: 'file.activity'; activity: FileActivity }
  | { type: 'workspace.state'; state: WorkspaceState }
  | { type: 'session.list'; paneId?: string; sessions: SessionInfo[] }

// ─── Supporting Types ───────────────────────────────────────

export interface PaneCreateConfig {
  name: string
  agent: AgentType
  workdir?: string
  task?: string
  mission?: PaneMission
  restore: RestoreMode
  isolation?: IsolationMode
  yolo?: boolean
  sessionId?: string
  cols?: number
  rows?: number
}

export type ConversationEvent =
  | {
    type: 'message'
    messageId: string
    role: 'user' | 'assistant'
    text: string
    append?: boolean
  }
  | {
    type: 'tool'
    toolCallId: string
    title: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
    text?: string
  }
  | {
    type: 'status'
    status: PaneStatus
  }

export interface DiscoveredSession {
  sessionId: string
  summary?: string
  model?: string
  costUsd?: number
  numTurns?: number
  createdAt?: string
  updatedAt?: string
  projectPath?: string
  source: 'nexus' | 'external'
}

export interface ReviewComment {
  file: string
  line: number
  content: string
}

export interface TaskItem {
  agentType: AgentType
  workdir?: string
  task: string
  createNewPane: boolean
  paneId?: string
}

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

export interface FileDiff {
  file: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  hunks: string
  paneId?: string
}

export interface SessionInfo {
  sessionId: string
  paneId: string
  paneName: string
  agent: AgentType
  timestamp: string
  costUsd?: number
  contextUsedPct?: number
  model?: string
}

export interface AgentAvailability {
  installed: boolean
  bin: string
  installHint: string
}

// ─── Hub Types ─────────────────────────────────────────────

export type HubInstanceStatus = 'running' | 'stopped'

export interface HubInstanceRecord {
  pid: number
  port: number
  cwd: string
  projectName: string
  startedAt: number
  status: HubInstanceStatus
}

export interface ConnectionTarget {
  serverId: string
  label: string
  httpBaseUrl: string
  wsBaseUrl: string
}

// ─── Dependency Graph Types ─────────────────────────────────

export interface DepNode {
  id: string        // relative file path
  imports: string[] // resolved relative paths this file imports
}

export interface DepGraph {
  nodes: DepNode[]
  root: string
}

// ─── Config Types ──────────────────────────────────────────

export interface GlobalConfig {
  version: string
  defaults: {
    shell: string
    scrollback_lines: number
    grid_columns: number
    history_retention_days: number
    theme: string
  }
  agents: Record<string, AgentDefinition>
  mission_defaults?: {
    agent_type?: AgentType
  }
  models: ModelConfig
}

export interface AgentDefinition {
  bin: string
  continue_flag: string
  resume_flag?: string
  resume_command?: string
  yolo_flag?: string
  statusline: boolean
  transport?: AgentTransport
  env?: Record<string, string>
}

export interface ModelConfig {
  defaults: {
    tool_model: string
  }
  providers: Record<string, ModelProviderConfig>
}

export interface ModelProviderConfig {
  name: string
  type: ModelProviderType
  enabled: boolean
  base_url: string
  api_key: string
  models: ModelDefinition[]
  proxy: {
    enabled: boolean
    mode: ModelProxyMode
    port: number
  }
}

export interface ModelDefinition {
  id: string
  name: string
  enabled: boolean
}

// ─── Replay Types ────────────────────────────────────────────

export type ReplayEventType = 'terminal' | 'status' | 'meta' | 'activity'

export interface ReplayEvent {
  t: number
  type: ReplayEventType
  paneId: string
  data?: string
  status?: PaneStatus
  meta?: PaneMeta
  activity?: FileActivity
}

export interface ReplayTurn {
  id: string
  paneId: string
  paneName: string
  agent: AgentType
  startedAt: number
  endedAt: number | null
  task?: string
  events: ReplayEvent[]
  summary: {
    filesRead: number
    filesEdited: number
    filesCreated: number
    terminalBytes: number
    durationMs: number
  }
}

export interface ReplaySession {
  id: string
  startedAt: number
  endedAt: number | null
  projectDir: string
  projectName: string
  panes: Array<{
    id: string
    name: string
    agent: AgentType
    task?: string
  }>
  turns: ReplayTurn[]
}

export interface ReplaySessionSummary {
  id: string
  startedAt: number
  endedAt: number | null
  projectName: string
  turnCount: number
  paneCount: number
  totalDurationMs: number
}
