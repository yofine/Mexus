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

## 建议方向

第一阶段不建议立刻单独开 Git diff WebSocket。更低风险的方案是减少 WS 上的 diff payload：

1. WebSocket 只推 Git diff 摘要：
   - unstaged/staged 文件数量
   - 文件路径
   - 文件状态
   - diff version/hash/timestamp

2. 完整 hunks 改为按需拉取：
   - 用户打开 Diff/Review 面板时拉取
   - 用户展开某个文件时拉取该文件 diff
   - 不在后台持续推送完整 hunks

3. 对 diff payload 做预算：
   - 单文件 hunks 大小上限
   - 单次推送总大小上限
   - 超限时只保留摘要，并标记需要按需加载

4. 对低优先级事件做 debounce 和过期丢弃：
   - 新 diff 计算完成后，如果旧 diff 尚未发送，可以直接丢弃旧版本
   - 避免 agent 高频写文件时堆积大量过期 diff

5. 保持 terminal live traffic 最高优先级：
   - `terminal.input`
   - `terminal.output`
   - `terminal.replay.*`

## 中期方案

如果摘要推送 + 按需拉取后仍然存在明显阻塞，再考虑把低优先级后台数据迁移到独立通道。

建议不要只为 Git diff 单独设计一个强耦合通道，而是考虑更通用的 background channel，用来承载：

- Git diff
- 文件树大更新
- Review 数据
- activity feed 历史批量加载
- 其它低优先级大 payload

## 非目标与边界

本优化只处理 Git diff 数据的传输和加载策略，不改 terminal 输入链路本身。

不建议在这个任务里同时重构 terminal 渲染、Pane UI、Review 工作流或 Agent 启动恢复逻辑。目标应保持明确：降低 `git.diff` 大 payload 对实时交互通道的影响。

## 推荐结论

短期目标：

> 不让完整 Git diff hunks 主动占用 terminal 所在的实时 WebSocket 通道。

优先实现：

> WS 推摘要，完整 diff 按需 REST 拉取。

---

## 现状速记

为避免实现时漏掉触点，先固定当前 git diff 链路的关键位置（基于本次走读）：

- 产生：`packages/server/src/git/GitService.ts:62-78` 调用 `getDiffs()`，`176-279` 解析 unstaged + staged；单文件 >256KB 已截断（`230-242`）。
- 触发：`.git` watcher 1000ms debounce（`25-51`），FsWatcher 1000ms debounce（`55-60`），客户端 `git.refresh`（`packages/server/src/ws/handlers.ts:154-156`）。
- 发送：`packages/server/src/ws/handlers.ts:88-90` 推 `git.diff { unstaged, staged }`，`12-16` 直接 `socket.send(JSON.stringify())`，无队列/优先级。
- 每 pane 还有 `pane.diff { paneId, diffs }`（`WorkspaceManager.ts:445-454`、`types.ts:123`），同样走主 WS。
- 客户端消费：`packages/web/src/stores/workspaceStore.ts:75-81, 352-376`；完整 hunks 实际只在 `GitDiffPanel.tsx:176-524` 展开文件时渲染；`FilesPanel.tsx:62-76` 只用 hunks 计 +/- 行数。
- 现有 REST：无 `/api/git/*`，所有 git 行为走 WS。

可以确认：**完整 hunks 在 UI 上 99% 时间是折叠的**，但仍然每次 refresh 全量推送 —— 这是优化的入口。

## Spec：WS 摘要化 + REST 按需拉取

### 首要约束：稳定性优先

本任务的最高优先级是**不破坏现有系统、不引入新问题**，性能优化排在其后。任何与稳定性冲突的设计选择，一律倒向稳定性侧。具体含义：

- **默认关闭，灰度开启**：新行为始终在 feature flag 后面，默认走旧路径。flag 默认 `off`（而非 spec 第一版写的 legacy=on 才回滚）。本地验证 → 个人 daily use 1 周 → 才默认开启。
- **不删除旧字段、不改旧消息形状**：`FileDiff.hunks` 字段在整个迁移期间保留并继续填充（受 flag 控制），只是新增 summary 字段。即使 web 端切到 summary 路径，server 仍能按 flag 回到旧行为。
- **不引入新依赖**：sha1 用 node 内置 `crypto`，LRU 自己写一个最小版（< 30 行）或干脆用 `Map` + size 上限，不引第三方包。
- **不改公共接口签名**：`GitService.getDiffs()`、WS message type union 等只新增、不修改既有字段类型。
- **不改既有触发点**：FsWatcher、`.git` watcher、`git.refresh` 三个入口的调用方式、debounce 时长（1000ms）、超时（15s）都保持不变。
- **每个 PR 自包含且可独立 revert**：见下文"工作分解"，每步合并后系统都必须能继续正常工作；不允许"中间态需要紧跟下一个 PR 才能用"。
- **失败必须降级而不是报错**：REST 拉取失败时，客户端回退到读 `summary` 显示行数 + 一个友好的"hunks 加载失败，点击重试"占位；不让 UI 整体白屏或卡死。
- **不动 terminal、PTY、replay、Pane UI、Review、Agent 启动恢复**：spec 末尾的"非目标"是硬边界。

### 已识别的回归风险（必须在实现前回答）

| 风险 | 触发条件 | 缓解 |
|---|---|---|
| REST 拉取慢导致展开卡顿 | 大文件 / 慢盘 / git 进程被 agent 占用 | server 内存缓存命中应 <5ms；未命中时前端骨架屏 + 超时 1.5s 提示；保留旧路径回退 |
| `hunksHash` 算法变化导致 review 全部失效 | 哈希实现切换 | 上线后**一次性**全部 stale 可接受（review 是用户主观标记），但需文档说明；不要再次更改算法 |
| `pane.diff` 与 `git.diff` 同时摘要化引入两条变更 | 一次改太多 | 先只改 `git.diff`，`pane.diff` 留到后续 PR；分两步落地 |
| 摘要 + 按需后 hunks 缓存膨胀爆内存 | 大仓库 + 长时间运行 | LRU 硬上限：200 entries / 16MB，超限 LRU 驱逐；server 加一个 `process.memoryUsage()` 周期性日志便于观察 |
| WS 消息字段缺失导致旧客户端崩溃 | 用户开着旧 tab，server 重启切到新协议 | 始终发送 `hunks: ''`（空串）而非省略字段；类型上保持向后兼容 |
| `git diff --numstat` 在某些 git 版本/边界情况输出不一致 | 子模块、binary、rename、符号链接 | 保留全量 `git diff` 作为唯一事实来源；numstat 仅作为加速路径，**首版不引入**，先把全量 diff 留在 server 缓存里只是不发 WS（备选方案中已提到，采用此路径） |
| 内存缓存与 GitService 重启不同步 | 切换 workspace / pane 重建 | 缓存挂在 `GitService` 实例上，跟随实例生命周期销毁，不做跨实例持久化 |

### 目标

1. 把 `git.diff` / `pane.diff` 的 WS payload 控制到一个稳定、可预测的小尺寸（目标：每文件 < 1KB，总 < 100KB）。
2. 让 `terminal.input` / `terminal.output` / `terminal.replay.*` 在大仓库 + 高频 agent 写盘场景下不再被 diff 阻塞。
3. 不破坏现有 UI：折叠态视觉零差异，展开态首次有一次按需加载延迟（可见 loading）。

### 非目标

- 不引入第二条 WebSocket。
- 不改 terminal 链路本身。
- 不改 git 写操作（accept/discard/commit/push 仍走 WS）。
- 不改 review/comment 数据模型，只保证 hunks 哈希仍可用于 stale 判定。

### 数据模型变更

新增 `FileDiffSummary`，与现有 `FileDiff` 并存（短期保留 `hunks` 字段，置为可选并默认空串以便兼容）：

```ts
// packages/server/src/types.ts  + packages/web/src/types.ts 同步
interface FileDiffSummary {
  file: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  insertions: number;     // 来自 git diff --numstat
  deletions: number;
  hunksHash: string;      // 完整 hunks 文本的 sha1，用于 review stale-check
  hunksBytes: number;     // 用于客户端预判是否值得自动展开
  truncated?: boolean;    // server 端 256KB 截断标记延续
  paneId?: string;
}
```

`git.diff` / `pane.diff` 改为只携带 `FileDiffSummary[]`，**不再带 `hunks` 文本**。

> 兼容策略：旧 `FileDiff.hunks` 字段在类型里保留但 server 永远发空串，客户端代码读到空串走"按需拉取"分支；一个 release 后再删除字段。

### 新增 REST 端点

在 `packages/server/src/` 下加 `git/routes.ts`，由 `index.ts` 注册：

- `GET /api/git/diff?file=<path>&staged=<0|1>` → `{ file, status, hunks, hunksHash, truncated }`
- `GET /api/git/diff/pane/:paneId?file=<path>&staged=<0|1>` → 同上，作用于 pane 的 worktree GitService
- 可选：`POST /api/git/diff/batch { files: [{file, staged}] }` 用于一次展开多个文件时合并请求（先不做，等出现 N+1 再加）

实现要点：
- 复用 `GitService` 现有 `simple-git` 实例，调 `git.diff(['--', file])` 或 `git.diff(['--cached', '--', file])`。
- 命中 256KB 截断逻辑时返回 `truncated: true` + 截断片段。
- 返回 `ETag: <hunksHash>`，前端带 `If-None-Match` 时 304；hash 不变就不重传 hunks 文本。

### Server 流程

为最小化风险，**采用"保留全量 diff、不改 git 调用方式"的路径**：

`GitService.getDiffs()`（`176-279`）改造（**新增字段、不改既有逻辑**）：

1. 保持现有的 `git.diff()` / `git.diff(['--cached'])` 调用与 `parseFileDiffs()` 解析完全不变。
2. 对每个 `FileDiff` 额外计算：
   - `insertions` / `deletions`：扫描已解析的 hunks 文本中 `^+` / `^-`（排除 `+++` / `---` 头）。**不引入 `git diff --numstat`**，避免与现有 diff 来源不一致的边界情况。
   - `hunksHash`：`crypto.createHash('sha1').update(hunks).digest('hex')`。
   - `hunksBytes`：`Buffer.byteLength(hunks)`。
3. 在 `GitService` 实例上挂一个内存缓存 `hunksCache: Map<key, { hash, hunks, size, lastAccess }>`，key = `${staged ? 's' : 'u'}:${file}`。每次 `refresh()` 用新结果写入；旧 key（已不在新结果中）删除。LRU 硬上限：200 entries 且总大小 ≤ 16MB，超限按 `lastAccess` 驱逐。
4. 输出仍是 `FileDiff[]`（带 hunks 字段），但 WS 发送层根据 flag 决定是否把 hunks 置空（见下一节）。

> 这样做的好处：`getDiffs()` 的产出对内部调用者完全等价，REST 端点直接读 `hunksCache`，WS payload 控制下放到发送层（一行代码切换）。如果出问题，把 flag 关掉就立刻回到旧行为，连缓存逻辑都可以保留不动。

### Debounce + 过期丢弃

`GitService.ts:15-16, 32-35, 56-59` 已有 1000ms debounce，符合要求；额外加：

- `refresh()` 进行中再被触发 → 标记 `pendingRefresh = true`，当前 promise resolve 后立即再跑一次，期间所有触发合并为一次。
- 上一次 `refresh()` 计算出的 summary 还没 `send()` 出去时若新结果产生，**直接丢弃旧的**（目前因为是同步 send 其实没问题，但显式化以防未来加队列）。

### WS 发送侧

`packages/server/src/ws/handlers.ts:12-16` 的 `send()` **不动**。改造点只在 `88-90`（`git.diff` 发送处）和 `WorkspaceManager.ts:445-454`（`pane.diff` 发送处）：发送前根据 flag 把每个 `FileDiff.hunks` 替换为空串、并附加 summary 字段。

不引入优先级队列。理由：摘要化后单条消息预期 < 100KB，配合 1000ms debounce，队头阻塞应已消失。如 benchmark 仍显示 terminal 抖动，再单开 PR 评估，**不在本期范围**。

### Client 流程

1. `workspaceStore.ts` 新增：
   - `gitDiffSummaries`, `gitStagedDiffSummaries`：`FileDiffSummary[]`，替换 `gitDiffs`/`gitStagedDiffs` 的角色。
   - `gitHunks: Map<file+staged, { hunks, hash, loadedAt }>`：按需加载的 hunks 缓存。
   - `loadHunks(file, staged)`：fetch REST，写入 `gitHunks`，并发去重（同 key 进行中的 promise 复用）。

2. `GitDiffPanel.tsx`：
   - 折叠态：只用 summary 显示 `+N -M` 和文件名 → 直接走 `insertions/deletions`，**不再依赖 hunks 文本**。
   - 展开态：触发 `loadHunks(file, staged)`，加载期间显示骨架 / loading，完成后渲染（现有 `DiffHunks` 组件不动）。
   - 折叠收起时不清缓存；hash 变更时 store 自动失效该条目。

3. `FilesPanel.tsx:62-76` 当前从 `diff.hunks` 数 `+` `-` 行 → 改为直接读 `summary.insertions/deletions`，这一步顺带省掉一次客户端正则扫描。

4. Review stale-check（`workspaceStore.ts:14-39`）：从"对 hunks 字符串求 hash"改为"读 summary.hunksHash"，逻辑等价。

### 验证

成功标准（按重要性排序）：

1. 在 unstaged 文件数 ≥ 200 的仓库下，单条 `git.diff` WS 消息 ≤ 100KB（当前可能数 MB）。
2. 同样场景下，terminal 输入回显延迟（按键到 `terminal.output` 到达）p95 ≤ 50ms。
3. 打开 GitDiffPanel 后展开第一个文件，端到端 ≤ 300ms（缓存命中 ≤ 50ms）。
4. Review marks 在 hunks 实际变化时被正确置为 stale，未变化时保留。

需要写的 benchmark / 测试：

- Server: `GitService.getDiffs()` 在合成的 500 文件 / 平均 5KB diff 仓库下的耗时与产出大小。
- 端到端：mock FsWatcher 高频触发 + 启一个 PTY 跑 `yes`，测 terminal output 到达时延的 p50/p95。
- 单测：`hunksHash` 在 hunks 不变时稳定，变了就变；REST 端点的 ETag 304 路径。

### 回滚

**默认关闭**新行为：

- Server 启动 flag `NEXUS_GIT_DIFF_SUMMARY=1`（默认 `0`/未设置 → 行为完全等同于今天）。
- Web 端通过 server 在 `bootstrap` 消息里下发同名 flag，客户端 store 读它决定走 REST 还是 hunks 字段。**不让 server / web 各自判断**，单一事实来源避免两端漂移。
- 出问题：去掉环境变量、重启 server，下次客户端 reload 即回到旧行为。整个迁移期间 `FileDiff.hunks` 字段在 wire 上始终存在（flag off 时填真值，on 时填空串）。

### 工作分解

按 PR 粒度，**每步合并后系统都必须能继续正常工作**，且默认行为与今天等价：

1. **纯加字段**：types 加 `insertions/deletions/hunksHash/hunksBytes`（可选字段），`GitService` 计算并填充，payload 仍含 `hunks`。客户端无变化（忽略新字段）。风险：极低。
2. **server 内存缓存**：`hunksCache` + LRU 上限 + 周期内存日志。仍不影响外部行为。风险：低，主要看内存上限是否合理。
3. **REST 端点**：`GET /api/git/diff` 和 `GET /api/git/diff/pane/:paneId`，从 `hunksCache` 读，未命中时同步切单文件 diff 兜底。带 ETag。客户端尚未使用。风险：低（新增端点，不影响存量路径）。
4. **客户端按需路径（影子模式）**：store 加 `gitHunks` + `loadHunks()`，`GitDiffPanel` 展开时**同时**读旧 hunks 字段和按需 REST（以旧字段为准展示，REST 结果仅用于对账日志）。验证 hash 一致性。风险：低。
5. **flag 切换发送**：引入 `NEXUS_GIT_DIFF_SUMMARY`，默认 `off`。on 时 server `git.diff` 把 `hunks` 置空、客户端走 REST。**仅 `git.diff`，不动 `pane.diff`**。本地 + daily use 验证 1 周。
6. **扩展到 `pane.diff`**：同样的 flag、同样的处理。独立 PR 便于回滚。
7. **默认开启**：flag 默认 `on`，保留关闭路径与字段。
8. **清理（远期，至少一个 release 后）**：删除 legacy 路径与 `hunks` 字段。**这一步不在本任务范围**，由后续单独决定。

每一步都不改 terminal 链路，每一步出问题都能单独回滚，每一步合并后默认行为与当前 main 等价。
