# 借鉴 Superset 的 Terminal 与 CLI 架构改造方案

> 目标：在不破坏 Mexus 当前轻量本地 Web 控制台架构的前提下，吸收 Superset 在 terminal/CLI agent 启动、重连、背压和任务启动协议上的成熟经验，优先解决多 pane 并发、重连历史、慢客户端和大输入稳定性问题。

## 1. 背景

Mexus 当前采用 `Fastify + WebSocket + node-pty + xterm.js` 的直接架构：

```text
Browser xterm.js
  ↕ WebSocket JSON events
Fastify Server
  ↕ PtyManager
node-pty shell / agent CLI
```

核心实现集中在：

| 模块 | 文件 | 当前职责 |
|---|---|---|
| PTY 生命周期 | `packages/server/src/pty/PtyManager.ts` | spawn/kill/write/resize/scrollback/status/meta |
| WS 路由 | `packages/server/src/ws/handlers.ts` | terminal input/output、pane create/close/restart |
| 前端终端 | `packages/web/src/components/Terminal.tsx` | xterm 初始化、resize、input 转发 |
| 前端旁路写入 | `packages/web/src/stores/terminalRegistry.ts` | terminal output 绕过 React state，RAF batching，前端历史 |
| CLI pane 管理 | `packages/server/src/cli/pane.ts` | `mexus pane create/list/close` |

Superset 的相关实现位于 `/root/workspace/superset`，主要分两代：

| Superset 模块 | 文件 | 价值 |
|---|---|---|
| v2 PTY daemon | `packages/pty-daemon` | 长驻 PTY 进程、Unix socket 协议、binary payload、session reattach |
| daemon manager | `apps/desktop/src/main/lib/terminal/daemon/daemon-manager.ts` | create/attach 合并、并发限制、cold restore、history |
| priority semaphore | `apps/desktop/src/main/lib/terminal/daemon/priority-semaphore.ts` | active pane 优先、可取消队列 |
| legacy terminal-host | `apps/desktop/src/main/terminal-host/session.ts` | headless xterm、shell ready marker、完整背压 |
| renderer terminal runtime | `apps/desktop/src/renderer/lib/terminal/*` | xterm runtime 与 transport 分离、parking |
| agent launch schema | `packages/shared/src/agent-launch.ts` | terminal/chat 统一启动请求、idempotency、attachments |

## 2. 总体判断

Superset 的完整 daemon 架构很强，但对 Mexus 来说不应第一阶段照搬。

原因：

1. Mexus 当前定位是本地 Web 控制台，部署形态比 Electron desktop 更简单。
2. 当前 `PtyManager` 约 300 多行，仍然可维护；直接替换为 daemon 会引入 socket 协议、进程监督、fd handoff、raw bytes 协议、迁移测试等大量复杂度。
3. Mexus 的高优先级问题更可能是慢客户端、大输出、大 paste、批量 spawn 和 replay 混杂，这些可以在现有架构上低成本修复。

建议路线：

```text
Phase 0: 稳定现有架构
  - WS terminal output 背压
  - PTY 输入写入队列
  - pane spawn 并发限流
  - replay 协议明确化

Phase 1: Server 重启不丢 terminal session
  - TerminalRuntime 接口
  - 最小可用 PTY daemon runtime
  - server 启动后 reattach daemon sessions
  - pane close / mexus stop 清理 daemon session

Phase 2: 结构化 terminal / agent launch
  - TerminalRuntime 接口
  - AgentLaunchRequest
  - xterm runtime parking
  - terminal/agent presets

Phase 3: daemon runtime 增强
  - binary payload / raw bytes
  - cold restore / history 完整化
  - 后续再评估 fd handoff
```

## 3. Phase 0：稳定现有 PTY 架构

### 3.1 WebSocket terminal output 背压

#### 当前问题

`packages/server/src/ws/handlers.ts` 中所有 server event 都直接：

```ts
socket.send(JSON.stringify(event))
```

如果某个浏览器标签页卡死、网络慢或后台 throttling，server 仍然持续推 terminal output。Mexus 有多客户端 Set-based 分发，一个慢客户端不应拖累其他客户端，也不应让 server 内存无限增长。

#### Superset 参考

`packages/pty-daemon/src/Server/Server.ts` 的 `writeMessage()` 在写 socket 前后检查 `socket.writableLength`，超过 `outboundBufferCap` 就 destroy 连接。

#### Mexus 方案

在 `setupWsHandlers()` 内引入 per-client `sendQueued()`：

```ts
interface WsSendQueue {
  queuedBytes: number
  queue: ServerEvent[]
  draining: boolean
}
```

规则：

- `workspace.state`、`pane.status`、`pane.meta`、`pane.added`、`pane.removed` 等控制事件优先发送。
- `terminal.output` 可合并：同一个 `paneId` 的连续 output 在队列中合并为一个 event。
- 每个客户端队列上限建议 `8MB`。
- 超过上限时断开当前 WS client，保留 PTY 和其他客户端。
- 断开前可尝试发送一条 `server.warning`，但不能依赖其一定送达。

建议新增文件：

```text
packages/server/src/ws/sendQueue.ts
```

职责：

- 封装 `createWsSendQueue(socket)`。
- 提供 `send(event: ServerEvent): void`。
- 对 terminal output 做合并。
- 对 queue bytes 做上限保护。

测试：

```text
packages/server/src/ws/sendQueue.test.ts
```

覆盖：

- 控制事件按顺序发送。
- 同 pane terminal output 合并。
- 不同 pane output 不错误合并。
- 超过上限时调用 `socket.close()` 或 `socket.terminate()`。

### 3.2 PTY 输入写入队列

#### 当前问题

`PtyManager.write()` 直接调用：

```ts
entry.pty.write(data)
```

大 paste、大 prompt 或自动批量广播时，`node-pty.write()` 可能在同一个 event loop tick 中处理大量数据，影响 WS、FS watcher、Git diff 的响应。

#### Superset 参考

`apps/desktop/src/main/lib/terminal/pty-write-queue.ts` 提供了：

- 固定 chunk size。
- 队列字节上限。
- 分 tick flush。
- 写失败时清队列。

#### Mexus 方案

新增：

```text
packages/server/src/pty/PtyWriteQueue.ts
```

参数建议：

| 参数 | 值 | 说明 |
|---|---:|---|
| chunkSize | `1024` bytes/chars | 比 Superset legacy 的 256 更适合 CLI prompt |
| flushDelayMs | `0` 或 `1` | 每个 chunk 后让出 event loop |
| maxQueueBytes | `1MB` | 防止输入堆积 |

`PtyEntry` 增加：

```ts
writeQueue: PtyWriteQueue
```

`PtyManager.write()` 改为：

```ts
entry.writeQueue.write(data)
```

写入队列满时：

- 返回 `false`。
- 触发 pane error/status 或 `terminal.writeRejected` 事件。
- 不直接 kill pane。

### 3.3 Pane spawn 并发限流

#### 当前问题

`WorkspaceManager.createPane()` 直接进入 `spawnPane()`，`spawnPane()` 直接调用 `PtyManager.spawn()`。批量创建 10+ pane 时，会同时启动 shell、加载 rc、启动 Agent CLI。

这会造成：

- 用户 shell profile 同时加载，CPU/IO spike。
- Agent CLI 同时做初始化，网络/API/auth 检查并发。
- 某些 pane 启动慢，失败原因难定位。

#### Superset 参考

`DaemonTerminalManager` 使用 `PrioritySemaphore`，并发数 `CREATE_OR_ATTACH_CONCURRENCY = 3`，active/focused pane 优先。

#### Mexus 方案

新增：

```text
packages/server/src/workspace/SpawnLimiter.ts
```

初始策略：

- 并发上限：`3`。
- 不做复杂 UI priority，先按 create 顺序 FIFO。
- 后续可给 active pane 或 user-triggered pane 加 priority。

`WorkspaceManager.spawnPane()` 改造为 async 或引入内部队列：

```ts
const release = await spawnLimiter.acquire()
try {
  const pid = this.ptyManager.spawn(...)
} finally {
  release()
}
```

注意：

- `pane.added` 应该在实际 spawn 成功后发出，避免 UI 出现无法交互的 phantom pane。
- 或者新增状态 `pending`，但这会改协议和 UI，Phase 0 暂不建议。

### 3.4 Replay 协议明确化

#### 当前问题

WS 新连接时，server replay scrollback 也发送 `terminal.output`。前端 `clearAllHistories()` 依赖连接重建时清历史，逻辑可用但脆弱。

问题：

- replay output 和 live output 无法区分。
- 多 pane 大 scrollback replay 时，前端不知道何时完成。
- 未来做 binary output 或 daemon reattach 时会成为协议债务。

#### Mexus 方案

扩展 server event：

```ts
type ServerEvent =
  | { type: 'terminal.replay.start'; paneId: string; bytes: number }
  | { type: 'terminal.replay.chunk'; paneId: string; data: string; seq: number }
  | { type: 'terminal.replay.end'; paneId: string; chunks: number }
  | { type: 'terminal.output'; paneId: string; data: string }
```

前端处理：

- `terminal.replay.start`：清空该 pane 前端 history 和 xterm。
- `terminal.replay.chunk`：写入 xterm 和 history，但标记为 replay。
- `terminal.replay.end`：允许之后 live output 正常 append。

兼容策略：

- 同时保留旧 `terminal.output`。
- 只改 replay path，不改 live output path。

## 4. Phase 1：Server 重启不丢 Terminal Session

一期目标调整为：Mexus server 重启、崩溃或开发热重启时，不杀掉正在运行的 shell / Agent CLI；server 恢复后能重新 attach 到原 terminal session，并恢复最近输出。

### 4.1 目标与非目标

一期必须做到：

- PTY 由独立 daemon 进程持有，不再由 Fastify server 进程直接持有。
- Mexus server 重启后，能连接已有 daemon。
- server 调用 daemon `list()` 找回仍存活的 session。
- `paneId` 与 daemon `sessionId` 一一对应。
- browser 刷新或 server 重启后，能重新看到同一个 shell / agent。
- pane close 时才 kill 对应 PTY。
- `mexus stop` 时清理 daemon 和其拥有的 PTY。

一期不做：

- daemon 自升级 fd handoff。
- daemon 崩溃后恢复原 PTY。
- browser WebSocket binary terminal output。
- headless xterm snapshot。
- 完整历史冷恢复。
- Windows ConPTY。

### 4.2 架构

当前：

```text
mexus server
  └─ node-pty
      └─ shell / agent CLI
```

一期目标：

```text
mexus server
  ↕ local IPC / Unix socket
mexus-pty-daemon
  └─ node-pty
      └─ shell / agent CLI
```

server 仍负责：

- WorkspaceManager。
- pane config。
- agents.yaml。
- StatuslineParser。
- Git / FS watcher。
- WebSocket browser clients。

daemon 只负责：

- PTY spawn / write / resize / close。
- session list。
- output subscribe。
- 小型 ring buffer replay。

daemon 不认识：

- mission。
- agent 类型。
- git diff。
- file tree。
- review。
- statusline meta。

### 4.3 TerminalRuntime 接口

Mexus 当前 `WorkspaceManager` 直接依赖 `PtyManager`。一期先抽接口，再提供 `PtyTerminalRuntime` 和 `DaemonTerminalRuntime` 两种实现。

新增：

```text
packages/server/src/runtime/TerminalRuntime.ts
```

接口草案：

```ts
export interface TerminalRuntime {
  spawn(paneId: string, config: PaneConfig, cols: number, rows: number): Promise<number | undefined> | number
  write(paneId: string, data: string): void
  resize(paneId: string, cols: number, rows: number): void
  kill(paneId: string): void
  killAll(): void
  getScrollback(paneId: string): string
  getStatus(paneId: string): PaneStatus
  getMeta(paneId: string): PaneMeta
  has(paneId: string): boolean
}
```

`PtyManager` 实现该接口，作为 fallback runtime。

一期新增：

```text
packages/server/src/runtime/DaemonTerminalRuntime.ts
```

`WorkspaceManager` 只依赖 `TerminalRuntime`，不直接依赖 `PtyManager`。

### 4.4 最小 PTY daemon 协议

新增 daemon 目录：

```text
packages/server/src/pty-daemon/
  main.ts
  Server.ts
  SessionStore.ts
  protocol.ts
  PtySession.ts
```

一期协议可以先用 JSON line 或 length-prefixed JSON。为了降低成本，第一版不要求 raw binary payload；terminal output 仍按 UTF-8 string 传给 server。后续 Phase 3 再升级 binary payload。

协议草案：

```ts
type DaemonClientMessage =
  | { type: 'hello'; version: 1 }
  | { type: 'open'; id: string; shell: string; argv: string[]; cwd: string; env: Record<string, string>; cols: number; rows: number }
  | { type: 'input'; id: string; data: string }
  | { type: 'resize'; id: string; cols: number; rows: number }
  | { type: 'close'; id: string; signal?: 'SIGHUP' | 'SIGTERM' | 'SIGKILL' }
  | { type: 'list' }
  | { type: 'subscribe'; id: string; replay: boolean }
  | { type: 'unsubscribe'; id: string }
  | { type: 'shutdown' }

type DaemonServerMessage =
  | { type: 'hello.ok'; version: 1; daemonPid: number }
  | { type: 'open.ok'; id: string; pid: number }
  | { type: 'list.result'; sessions: Array<{ id: string; pid: number; cols: number; rows: number; cwd: string; alive: boolean }> }
  | { type: 'output'; id: string; data: string; replay?: boolean }
  | { type: 'exit'; id: string; code: number | null; signal: number | null }
  | { type: 'closed'; id: string }
  | { type: 'error'; id?: string; code: string; message: string }
```

SessionStore：

```ts
interface DaemonSession {
  id: string
  pty: IPty
  pid: number
  cwd: string
  cols: number
  rows: number
  buffer: string[]
  bufferBytes: number
  alive: boolean
}
```

ring buffer 上限建议 `512KB`，与 Mexus 当前 `PtyManager` scrollback 保持一致。

### 4.5 Server 启动与 reattach

server 启动流程增加：

1. 根据 workspace 计算 daemon socket 路径：

```text
.nexus/runtime/pty-daemon.sock
```

2. 尝试连接 daemon。
3. 连接失败则 spawn daemon。
4. 连接成功后发送 `hello`。
5. 调用 `list()` 获取 live sessions。
6. `WorkspaceManager.init()` 初始化 panes 时：
   - 如果 pane id 在 daemon live sessions 中，走 attach。
   - 否则按原逻辑 spawn 新 session。

attach 后：

- `DaemonTerminalRuntime` 对该 session 发送 `subscribe(replay=true)`。
- daemon 先发送 buffer replay。
- 后续发送 live output。
- server 继续用 `StatuslineParser` 清理输出并广播 `pane.meta`。

### 4.6 关闭与清理

明确生命周期规则：

| 动作 | 行为 |
|---|---|
| browser 刷新 | 不 kill PTY，只断开 browser WS |
| Mexus server 重启 | 不 kill PTY，重启后 reattach |
| pane close | daemon close session，发送 SIGHUP |
| pane restart | close 旧 session，再 open 新 session |
| `mexus stop` | shutdown daemon，kill 所有 PTY |
| daemon 意外退出 | server 标记相关 pane `error`，允许用户 restart |

### 4.7 一期成本

一期 daemon 是中等工程，不是小修：

| 工作项 | 成本 | 说明 |
|---|---:|---|
| TerminalRuntime 抽象 | 0.5-1 天 | 主要是接口和 WorkspaceManager 调用点 |
| daemon MVP | 1-2 天 | open/input/resize/close/list/subscribe |
| DaemonTerminalRuntime | 1 天 | IPC client、事件桥接、scrollback replay |
| server 启动/reconcile | 1 天 | 发现 daemon、启动 daemon、attach live sessions |
| 清理与 stop | 0.5 天 | pane close、restart、mexus stop |
| 测试与边界 | 1-2 天 | session 保活、重启 attach、异常清理 |

总计：约 `5-7` 个工作日做到可用；如果要做到产品级稳定，建议预留 `1-2` 周。

### 4.8 一期风险

| 风险 | 说明 | 应对 |
|---|---|---|
| 进程泄漏 | server 崩溃后 daemon 留下是目标，但 stop/close 必须清理 | socket manifest + `mexus stop` shutdown + orphan 检查 |
| 状态不一致 | config 里有 pane，但 daemon session 不存在；或 daemon 有 orphan session | server 启动 reconcile，按 workspace pane id 对齐 |
| 调试复杂度上升 | terminal 问题跨 server/daemon 两个进程 | daemon stderr log 写入 `.nexus/runtime/pty-daemon.log` |
| IPC 协议 bug | JSON framing 半包/粘包处理错误 | 使用 length-prefixed frame 或成熟 decoder，补协议测试 |
| 输出语义变化 | replay/live/StatuslineParser 顺序可能出错 | Phase 0 replay 协议先落地，再接 daemon |
| 安全边界 | 本地 socket 被其他用户连接 | Unix socket 文件权限 `0600` |

### 4.9 一期验收

- 启动一个 Claude/Codex pane，确认 Agent 正在运行。
- kill 或重启 Mexus server 进程，不 kill daemon。
- 重新启动 Mexus server。
- UI 中原 pane 仍存在，terminal 继续接收同一 Agent session 输出。
- 向恢复后的 pane 输入命令，确认写入的是原 PTY。
- pane close 后，daemon list 不再显示该 session。
- `mexus stop` 后，daemon 和其 PTY 子进程都退出。

## 5. Phase 2：结构化 Terminal 与 Agent Launch

### 5.1 AgentLaunchRequest

#### 当前问题

Mexus 的 `pane.create` 同时承担 UI 创建 pane、CLI 创建 pane、mission 创建 pane。字段够用，但缺少统一的 launch 语义：

- 来源是谁发起：UI、CLI、mission、review、broadcast。
- 幂等 key：避免重复点击或重试创建重复 pane。
- prompt 是否自动执行。
- prompt 文件、附件等后续扩展。

#### Superset 参考

`packages/shared/src/agent-launch.ts` 用 discriminated union 区分 `terminal` 和 `chat`，并保留 legacy normalize。

#### Mexus 方案

先不引入 chat 分支，只定义 terminal agent launch：

```ts
export interface AgentLaunchRequest {
  kind: 'terminal'
  workspaceId?: string
  idempotencyKey?: string
  source: 'ui' | 'cli' | 'mission' | 'review' | 'broadcast' | 'unknown'
  agent: AgentType
  terminal: {
    name: string
    command?: string
    workdir?: string
    task?: string
    restore?: RestoreMode
    sessionId?: string
    autoExecute?: boolean
    yolo?: boolean
  }
  mission?: PaneMission
}
```

新增转换函数：

```text
packages/server/src/launch/agentLaunch.ts
```

职责：

- `normalizeAgentLaunchRequest(input)`。
- legacy `PaneCreateConfig -> AgentLaunchRequest`。
- `AgentLaunchRequest -> PaneConfig`。
- idempotency 由 `WorkspaceManager` 维护最近短期 map。

收益：

- Review 评论发给 agent 不必直接拼 `pane.create`。
- Mission Planner 可以一次生成多个 launch request。
- CLI 和 UI 共用同一语义。

### 5.2 Terminal runtime parking

#### 当前问题

Mexus 通过 `terminalRegistry` 避免 terminal output 进入 React state，并在 collapse/resume 时 replay history。这比普通 React state 好，但 xterm 实例仍和组件生命周期强绑定。

#### Superset 参考

`terminal-runtime-registry.ts` 将 xterm runtime 与 WebSocket transport 分离；React unmount 时把 wrapper park 到隐藏容器，避免销毁 xterm。

#### Mexus 方案

Phase 2 可渐进改造：

1. 保留 `terminalRegistry.ts` 的 API。
2. 新增隐藏容器：

```ts
function getTerminalParkingContainer(): HTMLElement
```

3. `Terminal.tsx` unmount 时不立即 `term.dispose()`，而是：

- pane close：dispose。
- component unmount/collapse：park。
- pane expand/remount：reattach DOM。

注意：

- 需要明确 `pane.removed` 时清理 runtime。
- 需要避免一个 pane 同时被两个 DOM 容器 attach。Mexus 当前多客户端是不同浏览器，不共享同一 JS runtime；同一浏览器内一般不会重复 attach，同步检查即可。

### 5.3 Terminal / Agent presets

Superset 有 terminal presets 和 agent presets。Mexus 可先做轻量版，避免 Settings UI 过重。

配置草案：

```yaml
presets:
  - id: claude-plan
    name: Claude Plan
    agent: claudecode
    restore: manual
    yolo: false
    taskTemplate: |
      请先阅读代码并给出方案，不要改代码。
  - id: codex-worker
    name: Codex Worker
    agent: codex
    restore: manual
    yolo: true
```

落点：

- 全局：`~/.nexus/config.yaml`
- 项目：`.nexus/config.yaml`

UI：

- `AddPaneDialog` 增加 preset dropdown。
- `CommandPalette` 可列出常用 preset。

CLI：

```bash
mexus pane create --preset claude-plan --name "Planner" --task "..."
```

## 6. Phase 3：Daemon Runtime 增强

Phase 3 的目标是在一期 daemon 可用后，进一步提升性能和恢复能力。

### 6.1 Daemon 边界

建议 daemon 只做 terminal primitive，不承载业务概念：

```text
open(sessionId, shell, argv, cwd, env, cols, rows)
input(sessionId, bytes)
resize(sessionId, cols, rows)
close(sessionId, signal)
list()
subscribe(sessionId, replay)
```

不要让 daemon 认识：

- pane name
- mission
- agent type
- git diff
- file tree
- statusline meta

这些仍由 Mexus server 管。

### 6.2 协议选择

Mexus 是浏览器 Web 控制台，不一定要在 browser 到 server 间使用 binary WS；但 server 到 daemon 建议借鉴 Superset：

```text
[u32 totalLen][u32 jsonLen][json header][binary payload]
```

原因：

- PTY bytes 不需要 base64。
- 不因 UTF-8 chunk 边界损坏字符。
- 控制消息和数据消息可共用一个 socket。

浏览器 WS 层可后续再评估：

- Phase 3a：daemon -> server raw bytes，server -> browser 仍 string JSON。
- Phase 3b：server -> browser terminal output 改 binary WS frame。

### 6.3 Reattach 与恢复

优先级：

1. daemon 内存 ring buffer：64KB-512KB。
2. server history writer：用于 cold restore。
3. headless xterm snapshot：暂不做第一版 daemon。

Mexus 当前已有 `.nexus/history/` 方向，可复用并收敛。

### 6.4 不建议第一版做 fd handoff

Superset 支持 daemon binary upgrade 时 fd handoff，这是 desktop 产品的高阶能力。Mexus 第一版 daemon 不建议做，理由：

- node-pty 私有 `_fd` 依赖脆弱。
- fd inheritance 和 adopted PTY resize 都有平台复杂度。
- Mexus 更核心的是 Web server 重启不丢 session，而不是 daemon 自升级不丢 session。

第一版目标应是：

- Mexus server 重启后可以 reconnect daemon sessions。
- 用户关闭 pane 才 kill terminal。
- daemon 随 `mexus stop` 退出。

## 7. 与现有 Mexus 功能的关系

### 7.1 StatuslineParser

保留在 server 层。

如果 Phase 3 daemon 输出 raw bytes，server 订阅 daemon output 后仍然可以：

1. 解码为 string。
2. 传给 `StatuslineParser`。
3. 清理 statusline JSON。
4. 再广播给 browser。

注意：如果追求 byte-perfect terminal output，statusline 剥离会破坏原始字节流。Mexus 的产品目标是 Agent 控制台，meta 提取价值更高，允许 server 层清理。

### 7.2 agents.yaml

仍由 `WorkspaceManager` / `AgentsYamlWriter` 管，不进入 daemon。

### 7.3 BottomTerminal

`__shell__` 也应走同一 terminal runtime。

Phase 0 的背压、写入队列、spawn 限流和 Phase 1 daemon runtime 对 `__shell__` 同样适用。

### 7.4 ACP Runtime

Mexus 已有 `AcpRuntime` 雏形。`TerminalRuntime` 抽象只覆盖 PTY 类 runtime，不应把 ACP 强行塞进 terminal runtime。

建议结构：

```text
RuntimeAdapter
  ├─ PtyTerminalRuntime
  ├─ DaemonTerminalRuntime
  └─ AcpRuntime
```

其中 PTY/daemon 共享 terminal event 协议，ACP 走 conversation event。

## 8. 风险与取舍

| 风险 | 阶段 | 应对 |
|---|---|---|
| WS 背压导致慢客户端断开 | Phase 0 | 只断开该 client，不影响 pane；前端自动重连 |
| 写入队列让大 paste 变慢 | Phase 0 | chunk size 设为 1024，优先响应稳定性 |
| spawn limiter 改变 pane 创建时序 | Phase 0 | 初版不引入 pending UI，spawn 成功后再 added |
| replay 新协议影响前端历史 | Phase 0 | 保留旧 output path，仅 replay 使用新事件 |
| runtime parking 引入 DOM 生命周期 bug | Phase 1 | 先只对 collapsed pane 生效，pane close 必须 dispose |
| daemon 增加运维复杂度 | Phase 1 | 一期 daemon 只做最小 session 保活，不做 fd handoff |
| raw bytes 与 statusline parser 冲突 | Phase 3 | server 层仍以 agent meta 优先，必要时保留 raw debug mode |

## 9. 验收标准

### Phase 0

- 同时创建 10 个 pane 时，server 不出现明显 event loop 卡死，pane 按并发上限逐步启动。
- 单个浏览器 tab 人为阻塞或断开时，不影响其他客户端收到 terminal output。
- 向 terminal paste 1MB 文本时，server 仍能响应 `/api/health` 和其他 WS 控制事件。
- 浏览器刷新后，每个 pane 的历史只 replay 一次，不重复叠加。
- `pnpm --filter @nexus/server build` 通过。
- `pnpm --filter @nexus/web build` 通过。

### Phase 1

- Mexus server 重启不杀掉正在运行的 terminal / Agent CLI。
- server 重启后能重新 attach 到 daemon 中已有的 pane session。
- 恢复后的 pane 可以继续输入并收到同一 PTY 的输出。
- pane close 会 kill 对应 daemon session。
- `mexus stop` 会清理 daemon 和所有 PTY 子进程。
- daemon 意外退出时，相关 pane 被标记为 `error`，用户可以 restart。

### Phase 2

- UI、CLI、mission 创建 pane 均可归一为 `AgentLaunchRequest`。
- 重复 idempotencyKey 不创建重复 pane。
- 折叠/展开 pane 不触发 xterm reset/replay，光标和滚动状态更稳定。
- preset 能从 UI 和 CLI 启动同一种 agent 配置。

### Phase 3

- `terminal.runtime=daemon` 时，Mexus server 重启后可重新 attach 仍在运行的 shell/agent。
- daemon 崩溃时 server 能明确标记 pane error，并允许用户 restart。
- `mexus stop` 能清理 daemon 和其拥有的 PTY。
- daemon runtime 与默认 pty runtime 可通过配置切换。

## 10. 推荐实施顺序

1. `ws/sendQueue.ts`：先解决慢客户端和输出堆积。
2. `pty/PtyWriteQueue.ts`：解决大输入阻塞。
3. `workspace/SpawnLimiter.ts`：解决批量 spawn。
4. `terminal.replay.*` 协议：解决重连语义。
5. `runtime/TerminalRuntime.ts`：建立 pty/daemon 统一接口。
6. `pty-daemon` MVP：实现 server 重启不丢 terminal session。
7. `launch/agentLaunch.ts`：统一 pane/agent 启动语义。
8. terminal runtime parking：优化前端生命周期。
9. presets：提升 CLI/UI 复用能力。
10. daemon runtime 增强：binary payload、cold restore、后续 fd handoff 评估。

## 11. 结论

Mexus 应该借鉴 Superset 的稳定性策略，而不是立即复制 Superset 的完整 daemon 架构。

最值得马上吸收的是：

- 慢客户端背压保护。
- 大输入写入队列。
- create/attach 并发限流。
- replay 与 live output 分离。
- server 重启后 reattach 原 terminal session。
- agent launch 请求结构化。

其中 “server 重启不丢 terminal session” 应进入一期目标，但一期 daemon 应保持最小边界：只做 PTY session 保活、reattach、输入输出转发和清理，不做 fd handoff、raw browser binary WS、headless snapshot 等高复杂度能力。
