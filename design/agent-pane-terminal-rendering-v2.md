# Agent Pane Terminal Rendering v2 修正方案

## 背景

Mexus 的 Agent Pane 终端体验经历了几类连续问题：

- Codex / Claude Code TUI 输出展示不全、缺行、内容被 prompt/status repaint 覆盖。
- Pane 折叠展开后内容缺失，或需要 replay 才能恢复。
- resume / reconnect 后历史从上到下明显打印很久，用户能感知 replay 加载过程。

当前实现已经引入 `@mexus/terminal` 和 `TerminalStage`，但它主要解决的是“Pane 切换时尽量不销毁 xterm”。它没有完整解决 replay 策略、latest viewport restore、历史静默补齐，以及 Mexus Web 对 terminal runtime 的统一接入。

本方案的目标是重新收敛 Agent Pane 终端渲染链路，让实现对齐真实体验目标，而不是继续对单点症状做补丁。

## 目标

### P0 目标

1. **Live TUI 输出稳定**
   - Codex / Claude Code / Shell 输出进入前端后，不因为二次 replay、隐藏、resize、错误 parser 或批处理而缺行。
   - 用户向上滚动时，Agent working/status repaint 不应强行拉回底部。

2. **Pane 折叠展开稳定**
   - 折叠不销毁 Agent terminal session。
   - 展开不依赖重新 replay 才能看到内容。
   - Pane 切换只改变 active terminal layer，不重建 xterm。

3. **Resume / reconnect replay 体验稳定**
   - 用户进入后优先看到最新一屏，而不是从历史开头开始打印。
   - 历史补齐在不可视区域或低优先级后台完成。
   - replay 不应该驱动当前可见 viewport 从上到下滚动。

### 非目标

- 不在本阶段实现完整 HTML transcript viewer。
- 不手写 ANSI parser 替代 xterm。
- 不要求历史无限保存。
- 不把 PTY 尺寸状态迁移到服务端长期维护。
- 不把 Review、Diff、FileTree 等非 terminal 问题混入此阶段。

## 当前实现偏差

### 1. 主应用未真正使用 `@mexus/terminal` replay adapter

`packages/mexus-terminal/src/adapters/mexus/adapter.ts` 已经定义了 Mexus event 到 runtime 的映射，但 Workspace 主链路仍然在 `WorkspaceApp.tsx` 中直接调用旧 `terminalRegistry`：

```ts
writeToTerminal(event.paneId, event.data)
resetTerminalForReplay(event.paneId)
writeReplayToTerminal(event.paneId, event.data)
finishTerminalReplay(event.paneId)
```

结果是：

- runtime 的 replay priority 没有真正接入主应用。
- snapshot cache key 设计没有进入主链路。
- `@mexus/terminal` 和 `terminalRegistry` 双轨并存，边界混乱。

### 2. server replay 协议只有顺序 history

当前 `buildTerminalReplayEvents()` 只截取最近 128KB，然后按顺序发：

```ts
const replayScrollback = scrollback.slice(-maxBytes)
data: replayScrollback.slice(i, i + chunkSize)
```

这天然导致用户看到历史从旧到新打印。它没有表达：

- latest viewport
- tail replay
- background history
- active pane priority
- inactive pane defer

### 3. Stage 解决的是挂载生命周期，不是 replay 体验

`AgentTerminalStage` 让多个 xterm layer 常驻，这对折叠展开是必要的。但它不能解决：

- 页面刷新后的历史恢复。
- resume 后的历史展示。
- 最新首屏优先。
- 静默补历史。
- transcript 与 TUI 当前屏幕分离。

### 4. runtime replay 仍是“clear 后写历史”

`TuiTerminalSession.createReplayWriter()` 当前行为是：

```ts
reset: () => {
  this.writeBuffer.clear()
  this.xterm?.clear?.()
}
write: (data) => {
  this.writeBuffer.writeLive(data)
}
```

这仍是把 replay 作为可见输出写入 xterm。它没有 viewport-preserving replay、latest-first restore 或 silent background fill 能力。

## 目标架构

### 数据分层

```text
PTY live output
  -> Server terminal stream
  -> WS terminal.output
  -> MexusTerminalAdapter
  -> TuiTerminalSession.writeLive()
  -> xterm current screen
```

```text
Resume / reconnect replay
  -> Server replay.tail
  -> Adapter restoreLatest()
  -> xterm latest viewport

  -> Server replay.history
  -> Adapter backfillHistory()
  -> background buffer / future transcript layer
```

### 关键分层

1. **Live Screen Layer**
   - xterm 当前屏幕。
   - 只负责真实 TUI 当前状态。
   - 不把历史顺序播放当成用户可见过程。

2. **Replay Restore Layer**
   - 负责连接、刷新、resume 后的恢复。
   - tail/latest 优先。
   - history 后台低优先级。

3. **Transcript / History Layer**
   - 后续用于完整历史查看。
   - 不等同于 xterm scrollback。
   - 当前阶段只做最小 backfill buffer，不做完整 UI。

4. **Stage Layer**
   - 管理多个 terminal session 的挂载和 active layer。
   - 不承担 replay 策略。
   - Terminal Stage 必须一直停留在 Pane 区域原位，不进入 fixed parking。
   - 收起时由 Pane List layer 覆盖 Terminal Stage，用户看不见 terminal，但 terminal surface 仍保持原尺寸渲染。

## 协议调整

### 当前协议

```ts
terminal.replay.start  // { paneId, bytes }
terminal.replay.chunk  // { paneId, data, seq }
terminal.replay.end    // { paneId, chunks }
```

### v2 协议

新增 `kind` 和 `mode`：

```ts
type TerminalReplayKind = 'tail' | 'history'
type TerminalReplayMode = 'replace-screen' | 'backfill'

terminal.replay.start {
  paneId: string
  replayId: string
  kind: TerminalReplayKind
  mode: TerminalReplayMode
  bytes: number
}

terminal.replay.chunk {
  paneId: string
  replayId: string
  data: string
  seq: number
}

terminal.replay.end {
  paneId: string
  replayId: string
  chunks: number
}
```

语义：

- `kind='tail' + mode='replace-screen'`
  - 用于首屏恢复。
  - 优先级最高。
  - 写入 xterm 前允许 clear。
  - 完成后 scroll 到底部。

- `kind='history' + mode='backfill'`
  - 用于历史补齐。
  - 不驱动当前可见 viewport。
  - 当前阶段可以只进入 runtime/history buffer，不直接写入 visible xterm。

## 服务端策略

### Replay 切分

从当前 scrollback 中切两段：

```text
tailReplayBytes: 32KB-64KB
historyReplayBytes: 128KB-512KB, excluding tail range
```

第一阶段建议：

- `tailReplayBytes = 64KB`
- `historyReplayBytes = 128KB`

先发当前 active pane 的 tail，再发其它 pane 的 tail。history backfill 延后。

### 连接时顺序

```text
1. workspace.state
2. active pane tail replay
3. visible/known pane tail replay
4. live terminal.output 正常插队
5. history backfill idle/background
```

注意：server 当前并不知道前端 active pane。v2 第一阶段可从客户端连接后发送：

```ts
terminal.replay.subscribe { activePaneId }
```

或者先保持 server 顺序，但前端 adapter 根据当前 active pane 做优先级。更完整方案是客户端在收到 `workspace.state` 后请求指定 pane tail。

## 前端策略

### WorkspaceApp

目标：把 terminal event 主链路从 `terminalRegistry` 切到 `MexusTerminalAdapter`。

当前：

```ts
terminal.output -> writeToTerminal()
terminal.replay.* -> terminalRegistry replay functions
```

目标：

```ts
terminal.output -> mexusTerminalAdapter.handleEvent()
terminal.replay.* -> mexusTerminalAdapter.handleEvent()
activePaneId change -> mexusTerminalAdapter.setActivePane()
workspace reset -> mexusTerminalAdapter.resetWorkspace()
```

### terminalRegistry

短期：

- 只保留 BottomTerminal 兼容。
- Agent Pane 不再直接依赖 `writeToTerminal()` / `resetTerminalForReplay()`。

中期：

- 移除 Agent Pane 对 `terminalRegistry` 的 writer 注册。
- `AgentTerminalStage` 直接使用 runtime session 写入。

### AgentTerminalStage

职责保留：

- 多 session layer 挂载。
- active layer 输入转发。
- active layer resize。
- inactive layer 不交互。
- Terminal Stage 原地铺满 Pane 区域。
- Pane List 和 Terminal Stage 是兄弟叠层：

```text
Pane Area
  ├── Terminal Stage Layer   // always mounted, original position, full size
  └── Pane List Layer        // collapsed: covers stage; expanded: only active header remains above stage
```

职责移除：

- 不拥有 replay。
- 不调用 `terminalRegistry` 的 replay/history。
- 不在 active 切换时强制 `scrollToBottom()`，除非用户本来就在底部或 tail restore 完成。
- 不使用 `position: fixed` / `opacity: 0` parking 来隐藏 stage。

## Runtime 策略

### 新增 Session API

建议新增：

```ts
interface RestoreTailOptions {
  data: string
  scrollToBottom?: boolean
}

interface BackfillHistoryOptions {
  data: string
}

interface TuiTerminalSession {
  restoreTail(options: RestoreTailOptions): void
  backfillHistory(options: BackfillHistoryOptions): void
}
```

第一阶段最小实现：

- `restoreTail()`：clear xterm，写 tail，一次性显示最新窗口。
- `backfillHistory()`：先进入内存 buffer，不写 visible xterm。

不在第一阶段实现完整“把历史插入 xterm scrollback 顶部”。xterm 本身没有稳定的 prepend scrollback API，强行做会继续制造 TUI 问题。

### 为什么不把 history 直接写进 xterm

把 history 写进 xterm 会触发：

- 可见区域滚动。
- TUI 控制序列重放。
- prompt/status repaint 二次执行。
- 用户看到加载过程。

所以 v2 不再把完整 history replay 当成“恢复 xterm”的方式。xterm 只恢复 latest screen/tail。

## 实施阶段

### 阶段 1：定义协议和测试

文件：

- `packages/server/src/types.ts`
- `packages/web/src/types.ts`
- `packages/server/src/ws/replay.ts`
- `packages/server/src/ws/replay.test.ts`

任务：

- 给 replay events 增加 `replayId/kind/mode`。
- 增加 `buildTerminalTailReplayEvents()`。
- 保留旧 `buildTerminalReplayEvents()` 兼容测试。

验收：

- tail replay 只包含最后 N bytes。
- history replay 不包含 tail range。
- replay events 带 kind/mode。

### 阶段 2：接入 MexusTerminalAdapter 主链路

文件：

- `packages/web/src/components/WorkspaceApp.tsx`
- `packages/mexus-terminal/src/adapters/mexus/adapter.ts`
- `packages/mexus-terminal/src/adapters/mexus/adapter.test.ts`

任务：

- WorkspaceApp 创建并持有 adapter。
- terminal output/replay 统一进入 adapter。
- activePaneId 同步到 adapter。
- workspace reset 时 adapter reset。

验收：

- Agent Pane 不再通过 `terminalRegistry.writeToTerminal()` 接收 live output。
- terminal output 进入 `TuiTerminalSession.writeLive()`。
- replay priority 测试覆盖 active/inactive。

### 阶段 3：runtime tail restore / history backfill

文件：

- `packages/mexus-terminal/src/core/terminal-session.ts`
- `packages/mexus-terminal/src/core/types.ts`
- `packages/mexus-terminal/src/core/terminal-session.test.ts`
- `packages/mexus-terminal/src/adapters/mexus/adapter.ts`

任务：

- 新增 `restoreTail()`。
- 新增 `backfillHistory()` 最小内存实现。
- adapter 根据 `mode` 分派。

验收：

- tail replay clear 后一次性恢复最新窗口。
- history backfill 不写入 xterm writer。
- live output 到达时中断或跳过低优先级 replay。

### 阶段 4：AgentTerminalStage 去 terminalRegistry 化

文件：

- `packages/web/src/components/AgentTerminalStage.tsx`
- `packages/web/src/components/Terminal.tsx`
- `packages/web/src/stores/terminalRegistry.ts`

任务：

- AgentTerminalStage 不再注册 `terminalRegistry` writer。
- StageTerminalLayer attach xterm 后直接交给 runtime session。
- BottomTerminal 继续保留旧 Terminal/registry 路径。

验收：

- Agent Pane output 不经过 registry。
- BottomTerminal 不受影响。
- 折叠展开不卸载 Agent xterm。
- 收起时 Pane List 覆盖 Terminal Stage；Terminal Stage 不离开 Pane 区域，不进入 fixed parking。

### 阶段 5：手工验证和回归 case

必须验证：

1. Codex 输出 120 行，展开/收起/切换 Pane 不缺大段行。
2. Pane 折叠后继续输出，展开后当前内容仍在。
3. Resume 后直接显示最新一屏，不从历史开头明显打印。
4. 用户向上滚动时，Agent working 状态不拉回底部。
5. BottomTerminal 输入输出不回归。

建议测试 prompt：

```text
Output exactly 120 numbered lines from MEXUS-RENDER-001 to MEXUS-RENDER-120. Do not use markdown fences. Do not skip or summarize. End with MEXUS-RENDER-COMPLETE.
```

## 风险

### xterm 不支持 prepend scrollback

这意味着“历史静默补齐到 xterm 上方”不能简单实现。v2 第一阶段不做 prepend，而是：

- xterm 恢复 latest/tail。
- history 存入 runtime buffer。
- 后续如果需要完整历史查看，用 transcript viewer，而不是强塞进 xterm scrollback。

### TUI 当前屏幕不是 transcript

Codex / Claude Code TUI 会使用 cursor movement、erase line、scroll region。即使 raw PTY 完整，xterm 当前屏幕也不等于完整文本历史。

因此验收重点应分开：

- 当前屏幕体验：xterm。
- 历史查看体验：transcript/replay viewer。

### 兼容现有 server replay

短期可以保持旧 replay 事件兼容，但进入 adapter 后必须将旧 `history` 当作低质量 fallback，不能作为理想恢复路径。

## 成功标准

此方案完成后，用户体验应达到：

- 正常 live 输出不缺行。
- Pane 折叠/展开不导致 xterm 丢内容。
- 切换 Pane 不触发 replay。
- resume/reconnect 后优先看到最新一屏。
- history 加载不以“从上到下打印”的形式暴露给用户。
- terminal runtime 成为 Agent Pane 的唯一 terminal output/replay 所有者。
