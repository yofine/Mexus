# Git Diff WebSocket Backpressure Optimization

## 背景

Mexus 当前把 terminal 交互事件和 Git diff 数据都放在同一条 WebSocket 连接里传输。

近期出现过 TUI terminal 看起来无法输入、底部 terminal 也不可用的问题。排查后发现，直接原因不是 `terminal.input` 链路断开，而是 unstaged 文件过多时，`git.diff` payload 太大，阻塞了同一条 WebSocket 通道，导致 terminal 输入后的回显和实时输出被延迟。

用户提交掉大量 unstaged 文件后，terminal 交互恢复正常，进一步验证了这个判断。

## 问题

`git.diff` 属于低优先级、大 payload、可延迟数据。

Terminal input/output 属于高优先级、实时交互数据。

两者共用一条无优先级 WebSocket 通道时，大 diff 会造成队头阻塞：

- terminal 输入可能已经发送或已写入 PTY，但回显被 `git.diff` 堵住。
- 浏览器收到大 JSON 后解析和状态更新也可能卡主线程。
- 用户体感会误判为 TUI terminal 无法输入。

大 diff 也可能影响 dev 进程稳定性，但目前只能作为候选原因，不能直接视为已确认根因：

- `git diff` 会把完整 diff 文本一次性读入 server 内存。
- `parseFileDiffs()` 会按文件拆分并持有额外副本。
- WebSocket 发送前 `JSON.stringify` 会再次产生大字符串。
- 浏览器侧 `JSON.parse` 和状态更新也会带来额外内存和主线程压力。
- 在大量 unstaged 文件、Agent 高频写文件、FsWatcher 频繁触发 diff refresh 的情况下，这些成本会叠加。

如果 dev 进程退出时伴随 `Killed`、exit code 137、OOM 日志、或退出前出现大量 `git diff timeout`，应优先把 Git diff 链路纳入排查。

## 现状速记

为避免实现时漏掉触点，先固定当前 git diff 链路的关键位置（基于本次走读）：

- 产生：`packages/server/src/git/GitService.ts:62-78` 调用 `getDiffs()`，`176-279` 解析 unstaged + staged；单文件 >256KB 已截断（`230-242`）。
- 触发：`.git` watcher 1000ms debounce（`25-51`），FsWatcher 1000ms debounce（`55-60`），客户端 `git.refresh`（`packages/server/src/ws/handlers.ts:154-156`）。
- 发送：`packages/server/src/ws/handlers.ts:88-90` 推 `git.diff { unstaged, staged }`，`12-16` 直接 `socket.send(JSON.stringify())`，无队列/优先级。
- 每 pane 还有 `pane.diff { paneId, diffs }`（`WorkspaceManager.ts:445-454`、`types.ts:123`），同样走主 WS。
- 客户端消费：`packages/web/src/stores/workspaceStore.ts:75-81, 352-376`；完整 hunks 实际只在 `GitDiffPanel.tsx:176-524` 展开文件时渲染；`FilesPanel.tsx:62-76` 只用 hunks 计 +/- 行数。
- 现有 REST：无 `/api/git/*`，所有 git 行为走 WS。

## 重新定位：把 git diff "隔离"，而不是"做得更好"

补充背景：git diff 在 Mexus 当前**使用频次很低** —— 绝大多数时间面板是关着的，但 server 仍在 FsWatcher 触发下持续算 diff、推 WS，反过来还把 terminal 拖慢。

所以本任务目标收敛为一句话：

> **git diff 功能本身一行不改，只让它在没人看的时候彻底闭嘴，避免影响 terminal 等核心链路。**

不做摘要化、不加 REST、不加缓存、不改类型、不改 UI、不改 review 逻辑。前期讨论过的"摘要 + REST 按需拉取"方案能力上更强，但成本和回归面与这个低频功能不匹配 —— **保留为远期备选，本期不实现**。

## Spec：按需订阅（subscribe-on-demand）

### 思路一句话

`GitDiffPanel` 打开时向 server 订阅 git diff 推送，关闭时取消订阅。**没有订阅者就完全不算、不发**。

### 唯一改动点

1. **客户端** `GitDiffPanel.tsx` 在 mount / unmount 时各发一条 WS 消息：
   - mount → `{ type: 'git.subscribe' }`
   - unmount → `{ type: 'git.unsubscribe' }`

2. **服务端** `packages/server/src/ws/handlers.ts` 维护一个 per-connection 布尔位 `gitSubscribed`（默认 `false`）：
   - 收到 `git.subscribe` → 置 `true`，立刻补发一次当前 diff（保持打开面板时的首屏体验）。
   - 收到 `git.unsubscribe` → 置 `false`。
   - `onGitDiff` 监听器（`88-90`）在 `send()` 前判断该位，`false` 时直接 return。

3. **服务端** `GitService` 增加一个引用计数 `subscriberCount`（所有连接的订阅状态求和）：
   - `subscriberCount === 0` 时，FsWatcher / `.git` watcher 触发的 `refresh()` 直接 **跳过 `getDiffs()`**，不调 git、不解析、不广播。
   - 第一个订阅者出现时立即跑一次 `refresh()` 补全。
   - 客户端显式 `git.refresh`（用户在 commit/discard 后手动刷新）始终生效，不受订阅状态影响。

就这三点。`pane.diff` 同理，但**第一阶段不动**，避免一次改两个链路。

### 为什么这是更合适的选择

- **不引入新协议、新端点、新类型、新缓存**：表面积接近为零。
- **关闭面板 = 零成本**：不算 diff、不解析、不 stringify、不 send。terminal 通道彻底干净。
- **打开面板 = 行为完全等同今天**：用户主动看 diff 时，所有逻辑（256KB 截断、review hash、+/- 行数、UI 渲染）一字不改。
- **可单 PR 完整 revert**：去掉订阅判断即恢复原状。
- **review stale-check 不受影响**：review 数据在客户端，订阅后拿到新 diff 时按现有逻辑比对，行为不变。

### 稳定性约束（不可妥协）

- **不改既有触发点的语义**：FsWatcher、`.git` watcher、`git.refresh` 三个入口的调用方式、debounce 时长（1000ms）、超时（15s）保持不变；只在 `refresh()` 入口处加一个早返回判断。
- **不改 `getDiffs()`、`parseFileDiffs()` 的实现**。
- **不改 `FileDiff` 类型**、不改 WS message 形状（只新增两条 message type）。
- **不引入新依赖**。
- **不动 terminal、PTY、replay、Pane UI、Review、Agent 启动恢复**。
- **失败必须降级**：客户端发送订阅消息失败（socket 未连接、reconnect 中）不影响 panel 渲染；server 在没收到订阅消息时维持默认"未订阅"状态 —— 兜底见下。

### 边界与降级

| 情况 | 行为 |
|---|---|
| 多 tab / 多客户端 | 每个 WS 连接独立维护订阅位；引用计数为 0 才停算。所有 tab 都关掉 diff 面板才真正"闭嘴"。 |
| 客户端断连 | socket close 时把该连接对订阅计数的贡献归零（在 `setupWsHandlers` 现有 `close` 钩子里追加）。 |
| reconnect | `GitDiffPanel` 仍挂载时，新 socket 建立后重新 emit `git.subscribe`，自然恢复推送。 |
| 旧客户端连新 server | 客户端不会发 `git.subscribe`，server 视为未订阅 → diff 不推。**这是回归点**。缓解：见下面的兜底 flag。 |
| commit / push / discard 后 | 现有路径仍 emit `git.refresh`，server 端这条路径**绕过订阅判断**，保证写后立即看到结果。 |
| 初次连接打开 panel 之前 | server `index.ts:116-122` 当前会主动推一次 `git.diff` 作首屏；改为延后到收到 `git.subscribe` 时推（语义等价：panel 没打开就不需要首屏数据）。 |

兜底回滚 flag：`NEXUS_GIT_DIFF_ALWAYS_ON=1`（默认 off）。打开后所有判断短路为"始终订阅"，行为完全退回今天。出问题一行环境变量恢复。

### 非目标（明确不做）

- 不做摘要 / REST / ETag / 按需 hunks 加载。
- 不引入第二条 WS、不加优先级队列。
- 不改 debounce、超时、截断阈值。
- 不改 `FileDiff` 类型、不改 WS payload 形状。
- 不动 `pane.diff` 链路（除非第二阶段单独评估）。
- 不动 terminal、PTY、replay、review、commit / push / discard 流程。

### 验证

只要满足两条，主观可感即可，不强求 benchmark：

1. **关闭 GitDiffPanel** 后，制造大量 unstaged 文件 + agent 高频写盘，terminal 回显没有明显卡顿。和今天面板关着时的对比 —— 应该感觉更稳。
2. **打开 GitDiffPanel**，diff 显示、+/- 行数、review stale、commit / discard / push 等所有现有行为与今天**完全一致**。手动跑一遍核心 case。

附带 sanity check：
- server 日志里在面板关闭期间，应该看不到 "GitService refresh" 之类的日志（如果当前没有，加一行 debug 日志短期验证用，验证完删掉）。
- 打开面板瞬间应能看到补发的 `git.diff`，UI 显示与刷新前一致。

### 工作分解

一个 PR 搞定：

1. types 加 `git.subscribe` / `git.unsubscribe` 两条 client→server 消息（server 和 web 的 `types.ts` 同步加）。
2. `ws/handlers.ts` 加 `gitSubscribed` 状态 + 消息处理 + `onGitDiff` 发送前判断 + `close` 钩子清理。
3. `GitService` 加 `subscriberCount` + `addSubscriber()` / `removeSubscriber()` 接口；`refresh()` 入口在 count 为 0 且非 `force` 调用时早返回；`git.refresh` 命令调用时传 `force=true`。
4. 初次连接的首屏推送（`index.ts:116-122`）从无条件推改为收到 `git.subscribe` 时推。
5. `GitDiffPanel.tsx` 在 mount / unmount 时发送两条订阅消息（用 `useEffect` cleanup）。
6. 加 `NEXUS_GIT_DIFF_ALWAYS_ON` 兜底 flag。

出问题 → 单 commit revert。

### 远期备选（不在本期）

如果日后 git diff 使用频次明显上升（例如长期开着 panel 边看边改），再回头评估"摘要 + REST 按需拉取"方案。届时 spec 思路已在前面"建议方向"和"中期方案"小节里，可直接拾起。本期不为这个可能性付任何额外成本。
