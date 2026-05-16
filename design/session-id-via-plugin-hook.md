# 通过内置 Plugin Hook 自动绑定 SessionId

> 让 Nexus 在不污染用户配置的前提下，通过随产品分发的 plugin，让 CLI agent 在 session 开始时主动把 `session_id` 报给 Nexus server。彻底替代当前依赖 statusline 输出解析 sessionId 的脆弱机制。

## 1. 背景与问题

### 1.1 当前 sessionId 发现机制及缺陷

| 阶段 | 实现 | 问题 |
|------|------|------|
| 解析 | `comm/StatuslineParser.ts` 从 PTY 输出里解析 `{"session_id":"...","model":"...",...}` JSON 行 | 依赖 Claude Code 用户自己在 `~/.claude/settings.json` 配置了 statusline 命令；codex/opencode/kimi/qoder 在 agent 定义里 `statusline: false`，根本不会输出这种 JSON |
| 写回 | `workspace/WorkspaceManager.ts:425-428` 拿到 meta 后写回 `.nexus/config.yaml` | 仅在 statusline 触发时才执行；多数 pane 永远拿不到 sessionId |
| 恢复 | `workspace/WorkspaceManager.ts:95-100` server 启动时若 `paneConfig.sessionId` 存在则强制 `restore: 'resume'` | 上一步没存上，这条永远走不到，pane 全部退化为 `restart`（带 task 起新会话） |
| 命令拼装 | `pty/agentCommand.ts:41` resume 模式仍把 `task` 当成 prompt 附加到 `--resume <id>` 后 | （已修）resume 时不再附加 prompt，已在该 commit 落地 |

实测结果：`.nexus/config.yaml` 中 7 个 pane 一个 `sessionId` 都没存上。server 重启后全部退化为新 session 并重新跑 task。

### 1.2 已评估并淘汰的替代方案

| 方案 | 否决原因 |
|------|---------|
| **提示词注入** — 启动后向 PTY 写 prompt 让 agent 输出 sessionId | Agent 进程的 LLM 本身不知道自己的 session id，session id 是 CLI host 层概念，不会暴露给模型；模型会编造或拒答 |
| **扫描本地 session store（`~/.claude/projects/...`、`~/.codex/sessions/...`）** | 多 pane 并发启动 + 外部 CLI 并发 → 文件归属判定有竞态；每种 agent 的存储路径/文件格式都得各自适配；agent 版本变更无通知 |
| **Launcher 包裹脚本** | 本质上还是扫文件，只是挪进 launcher 进程；多一层 PTY 透传需要正确处理信号/resize/退出码 |
| **入侵用户 settings.json 注入 hook** | 污染用户全局配置；与用户已有 hook/MCP 冲突；卸载 Nexus 不容易清理 |

### 1.3 选定方案

**Nexus 内置 plugin + 进程级加载**。Plugin 作为 Nexus 产品的一部分分发，通过 CLI 提供的"为本次进程加载 plugin"的 flag 加载，不写入用户全局配置。Plugin 内置 `SessionStart` hook，在 agent 启动时把 `session_id` 通过 HTTP 报给 Nexus 本地 server。

## 2. 已完成的可行性验证（2026-05-16）

最小 plugin 已落地为 monorepo 内置包 `packages/mexus-plugin/`，链路完整可用。验证使用的 Claude Code 版本：**2.1.111**。

### 2.1 Plugin 包结构（`packages/mexus-plugin/`）

```
packages/mexus-plugin/
├── package.json                 # @mexus/plugin（monorepo 成员）
├── README.md
├── .claude-plugin/
│   └── plugin.json              # Claude Code plugin manifest
└── hooks/
    ├── hooks.json               # 声明 SessionStart -> session-start.sh
    └── session-start.sh         # 读 stdin JSON → curl POST 给 Mexus
```

这是一个综合性的 Mexus runtime bridge 插件，承载所有 agent → Mexus 的回调能力。`SessionStart` 是首个能力，未来 PreToolUse / SessionEnd 等会逐步加进同一个包。

### 2.2 启动方式

```bash
MEXUS_PANE_ID=test-pane-1 \
MEXUS_BIND_URL=http://127.0.0.1:17700/api/internal/session-bind \
MEXUS_BIND_TOKEN=dev-token-xyz \
MEXUS_PLUGIN_DEBUG=1 \
claude --plugin-dir "$PWD/packages/mexus-plugin" \
  -p "say only OK"
```

### 2.3 实测确认的事实

| 项 | 结果 |
|---|---|
| `claude --plugin-dir <path>` flag | ✅ 真实存在。`claude --help` 描述："Load plugins from a directory for this session only (repeatable)" |
| SessionStart hook input via stdin（JSON） | ✅ 字段：`session_id`, `transcript_path`, `cwd`, `hook_event_name`, `source`, `permission_mode` |
| 首次启动触发 | ✅ `source = "startup"` |
| `--resume <id>` 启动也触发 | ✅ `source = "resume"`，`session_id` 等于命令行传入的 id（不会变化） |
| 环境变量穿透（MEXUS_PANE_ID 等） | ✅ hook 脚本能正常读取 |
| 不污染 `~/.claude/settings.json` | ✅ 完全独立，会话结束后无残留 |
| 用户已有 hook 共存 | ✅ 由 Claude Code 自动堆叠（未验证多 hook 顺序，但官方文档明确支持） |

### 2.4 实测命令输出（节选）

```
=== plugin log ===
SessionStart fired. input={"session_id":"10e1d975-0034-467b-bf92-3a5b542f276b",
  "transcript_path":"/root/.claude/projects/-root-workspace-Nexus/10e1d975-....jsonl",
  "cwd":"/root/workspace/Nexus","hook_event_name":"SessionStart","source":"startup"}
POST http://127.0.0.1:17700/api/internal/session-bind
  payload={"paneId":"test-pane-1","sessionId":"10e1d975-0034-467b-bf92-3a5b542f276b",
    "agent":"claudecode","source":"startup"}

=== mock server log ===
[2026-05-15T19:05:30.126Z] POST /api/internal/session-bind
  headers.x-nexus-token: dev-token-xyz
  body: {"paneId":"test-pane-1","sessionId":"10e1d975-...","agent":"claudecode","source":"startup"}
```

`--resume` 验证：claude 真的恢复了上一次会话（"Your last message was: 'say only OK'"），证明 `--resume <id>` 在不带 prompt 时是干净恢复，与本设计的命令拼装假设一致（resume 不附加 task，已落地）。

## 3. 目标设计

### 3.1 总体形态

```text
┌────────────────────────────────────────────────────────────────┐
│ Mexus server                                                   │
│   PtyManager.spawn()                                           │
│     ├─ 为 claudecode pane 注入：                               │
│     │    args: --plugin-dir <repoRoot>/packages/mexus-plugin   │
│     │    env:  MEXUS_PANE_ID, MEXUS_BIND_URL, MEXUS_BIND_TOKEN │
│     └─ 在 pendingTokens 里登记 paneId → token                  │
│                                                                │
│   Fastify route POST /api/internal/session-bind                │
│     校验 X-Mexus-Token →                                       │
│     workspaceManager.bindSessionId(paneId, sessionId, agent)   │
└────────────────────────────────────────────────────────────────┘
                       ▲  HTTP POST（localhost only）
                       │
                   pane PTY 进程
                       │
       claude --plugin-dir <repoRoot>/packages/mexus-plugin
                       │
                       ▼
              SessionStart hook → curl
```

### 3.2 Plugin 分发

Plugin 是 monorepo 内的一等公民包：`packages/mexus-plugin/`（`@mexus/plugin`）。随 `@nexus/server` 一起分发。

运行时定位：`path.resolve(packageRoot, '../mexus-plugin')`，或在 `@nexus/server` 启动时通过 `require.resolve('@mexus/plugin/package.json')` + `dirname` 拿到。具体实现选哪条看 server 的打包方式（tsup 输出后路径还是否能命中 `../mexus-plugin`），首版用前者，必要时再加 fallback。

不采用：把 plugin 拷到 `~/.mexus/plugins/` 再从那里加载 —— 升级同步麻烦，没收益。

### 3.3 Server 端改动

#### 3.3.1 新增 Fastify 路由

`packages/server/src/index.ts` 或新建 `packages/server/src/routes/internal.ts`：

```ts
fastify.post('/api/internal/session-bind', async (req, reply) => {
  const token = req.headers['x-mexus-token']
  const { paneId, sessionId, agent, source } = req.body as {...}
  if (!workspaceManager.consumeBindToken(paneId, token)) {
    return reply.code(401).send({ error: 'invalid token' })
  }
  workspaceManager.bindSessionId(paneId, sessionId)
  return { ok: true }
})
```

要点：
- 仅监听 localhost（Fastify 当前已是 `127.0.0.1`）。
- Token 一次性：bind 成功后置 used，再次相同 token 直接 401（防止跨 pane 串改）。Token 随 PtyManager.kill() 一并清理。
- 不暴露在浏览器可达的 `/api/*` 文档里（路径 `/api/internal/*` 表意 + 加 `reply.header('Cache-Control','no-store')`）。
- 简单 IP 白名单（仅接受 `req.ip === '127.0.0.1'`）防 DNS rebinding 一类的远端伪造（虽然只听 localhost，但加一层不亏）。

#### 3.3.2 WorkspaceManager / PtyManager 改动

**新增字段与方法：**

```ts
// PtyManager.ts
interface PtyEntry {
  // …existing
  bindToken: string | null     // 启动时生成，bind 成功后清空
}

// WorkspaceManager.ts
issueBindToken(paneId: string): string   // 16 字节随机 hex
consumeBindToken(paneId: string, token: string): boolean
bindSessionId(paneId: string, sessionId: string): void
  // 等价于现在 onMeta 里 ts:425-428 那块：写回 config.yaml + 更新 PaneState + emit onPaneMeta
```

**spawn 时注入：**

`packages/server/src/pty/PtyManager.ts:67` 附近，构建 agentCommand 之前：

```ts
if (config.agent === 'claudecode') {
  const token = ctx.workspaceManager.issueBindToken(config.id)
  const pluginDir = path.resolve(__dirname, '../../../mexus-plugin')
  env.MEXUS_PANE_ID = config.id
  env.MEXUS_BIND_URL = `http://127.0.0.1:${ctx.serverPort}/api/internal/session-bind`
  env.MEXUS_BIND_TOKEN = token
  // 把 plugin-dir 注入到 agentCommand —— 需扩展 buildAgentCommand 接口
}
```

`buildAgentCommand` 需新增一个 `extraArgs?: string[]` 入参，在 `--resume` / `--continue` 之前/之后插入 `--plugin-dir <path>`（具体位置无所谓，但建议放在 flag 段最前以利日志清晰）。

#### 3.3.3 移除 statusline 路径的 sessionId 写回

`packages/server/src/workspace/WorkspaceManager.ts:425-428` 现在的代码：

```ts
if (meta.sessionId && meta.sessionId !== p.sessionId) {
  p.sessionId = meta.sessionId
  this.updatePaneConfigSessionId(config.id, meta.sessionId)
}
```

**做法**：保留 `model` / `costUsd` / `contextUsedPct` 部分（这些 statusline 仍是合法来源），只**移除 sessionId 这一段**。Single source of truth 由 plugin hook 提供。

#### 3.3.4 Agent 定义扩展

每种 agent 是否支持 plugin-bind 由 agent 定义声明：

```ts
// types.ts
interface AgentDefinition {
  // …existing
  plugin_bind?: {
    plugin_dir_flag?: string      // e.g. '--plugin-dir'
    plugin_dir_path?: string      // 解析到 plugins/<name>
  }
}
```

`ConfigManager.ts:33-37` 的 `claudecode` 默认定义里加：

```ts
plugin_bind: {
  plugin_dir_flag: '--plugin-dir',
  plugin_pkg: '@mexus/plugin',         // 通过包名解析路径
}
```

其他 agent 不配 `plugin_bind`，即不参与该机制。

### 3.4 Plugin 端契约

`packages/mexus-plugin/hooks/session-start.sh`（已实装）规定：

- 输入：stdin 一行 JSON，至少含 `session_id` 字符串字段。
- 环境变量：`MEXUS_PANE_ID`、`MEXUS_BIND_URL` 必需；`MEXUS_BIND_TOKEN` 可选（缺失时仍发，但 server 401，仅做日志）。
- 行为：尝试 `curl --max-time 3 POST`，无论成败 **always exit 0**，避免 hook 失败阻塞 agent 启动。
- 失败日志：`/tmp/mexus-plugin.log`（仅当 `MEXUS_PLUGIN_DEBUG=1`）。生产默认无日志。

不依赖 `jq`（用 sed fallback），保证用户机器没装 jq 也能用。

## 4. 失败/降级行为

| 场景 | 行为 |
|------|------|
| Plugin 文件不存在 | claude 启动失败，PaneStatus = error；server 应在加载时预检 plugin 目录存在 |
| Nexus server 在 hook 触发前已挂 | curl 超时 3s，hook 退出 0，agent 继续；server 重启后没有该 sessionId，pane 回退为 restart 但 task 不再附加（依赖 §3.5 的兜底） |
| Hook 执行被用户/企业 policy 禁用 | sessionId 不会被绑定，回退到 restart；同时记录 server warning 提示用户 |
| Plugin 版本与 CLI 不兼容（schema 变化） | 同上，回退到 restart |
| 用户已有自己的 SessionStart hook | 共存，两个 hook 顺序执行；不存在覆盖问题 |

### 3.5 task 不重放兜底（必须做）

即使 sessionId 没绑上，server 重启时**不应该把 task 当成新 prompt 重新发**。当前 `WorkspaceManager.init()` 在没有 sessionId 时会保留原 `restore` mode（多为 `restart`），然后 `agentCommand.ts:41` 把 task 拼到命令行 → 新会话又跑了一次任务。

修法：`WorkspaceManager.init()` 在 `paneConfig.sessionId` 为空时，把 `restore` 降级到 `'manual'`（manual 模式 `buildInitialPrompt` 返回 null）。这样无 sessionId 的 pane 重启后只起一个干净 agent，用户可以手工 resume 或重新发任务。

## 5. 安全考虑

- **Token 一次性 + per-pane**：泄漏一个 token 只能绑定一个 pane 的一次 sessionId，影响有限。
- **仅 127.0.0.1**：Nexus server 本来就只听 localhost，hook 也只 curl 本地。
- **不写敏感数据到 plugin log**：当前 plugin 脚本会把完整 hook input 写到 `/tmp/...log`，这只在 debug 阶段开。正式版默认关闭，可由 `NEXUS_PLUGIN_DEBUG=1` 开启。
- **Token 应该是 cryptographically random**：`crypto.randomBytes(16).toString('hex')`，不是 `Math.random()`。

## 6. 实施步骤

### Phase A — Plugin 包 + Server 端集成（1-2 天）

1. ✅ `packages/mexus-plugin/`（`@mexus/plugin`）已就位：`.claude-plugin/plugin.json` + `hooks/hooks.json` + `hooks/session-start.sh`，pnpm 已识别为 workspace 包。
2. `packages/server/src/index.ts`：加 `POST /api/internal/session-bind` 路由（仅 127.0.0.1，校验 X-Mexus-Token）。
3. `WorkspaceManager`：加 `issueBindToken` / `consumeBindToken` / `bindSessionId`；移除 ts:425-428 的 statusline → sessionId 写回。
4. `ConfigManager`：claudecode agent 定义加 `plugin_bind: { plugin_dir_flag: '--plugin-dir', plugin_pkg: '@mexus/plugin' }`。
5. `agentCommand.ts`：加 `extraArgs` 支持，调用方根据 `plugin_bind` 拼 `--plugin-dir <abs path>`。
6. `PtyManager.spawn`：注入 env + 调用 `issueBindToken`；kill 时清 token；启动时自检 plugin dir 存在，否则 log warn 跳过 plugin 注入（不阻塞 agent 启动）。
7. `WorkspaceManager.init` ts:95-100 周围：无 sessionId 时把 `restore` 降级为 `'manual'`（§3.5 兜底）。
8. 端到端测试：本地起 server → 创建 claudecode pane → 检查 `.nexus/config.yaml` 是否记录到 sessionId → 重启 server → 检查 pane 是否走 `--resume`。

### Phase C — 覆盖其他 agent（按需）

每种 agent 的 plugin 能力差异较大，逐个评估：

| Agent | 备注 |
|-------|------|
| **codex** | 是否有等价 SessionStart hook 待查；有 `~/.codex/config.toml` + MCP server 概念，但 hook 系统未确认 |
| **opencode** | 有 plugin 系统（JS），需查接口 |
| **kimi-cli** | 未知 |
| **qodercli** | 未知 |

不能做 plugin hook 的 agent，仍可保留 `session-resume-design.md` 中的"手动 Resume UI"作为兜底入口。

## 7. 与现有设计的关系

| 设计 | 关系 |
|------|------|
| `session-resume-design.md` | 互补，不冲突。手动 Resume UI 仍然有价值（恢复昨天的会话、用户主动切换 session）。Plugin hook 只解决"重启自动恢复"这一条主路径。 |
| `superset-terminal-cli-lessons-plan.md` Phase 1（PTY daemon） | 长期方向。daemon 落地后 sessionId 绑定问题彻底消失（PTY 不再丢）。Plugin hook 是 daemon 落地前的过渡方案，落地后可保留也可下线（看是否还希望让 Nexus 知道 sessionId 用于历史查询/UI 展示）。 |
| `comm/StatuslineParser.ts` | 保留 model/cost/context_used_pct 解析（这些有独立价值），仅移除 sessionId 解析分支。 |

## 8. 已确认要修的当前 Bug

| Bug | 位置 | 状态 |
|-----|------|------|
| Resume 模式仍拼接 task 到 `--resume <id>` 命令行，导致 task 重放 | `pty/agentCommand.ts:41` | ✅ 已修（本次 commit） |
| Server 重启时无 sessionId 仍带 task 起新会话 | `workspace/WorkspaceManager.ts:init()` + `agentCommand.ts:41` | 计划在 Phase A 一并修（§3.5） |
| StatuslineParser 是 sessionId 唯一来源，对 codex/opencode 等无效 | `comm/StatuslineParser.ts` + `workspace/WorkspaceManager.ts:425-428` | 计划在 Phase A 移除写回分支 |

## 9. 验收

- 创建一个 claudecode pane，正常对话几轮。
- `.nexus/config.yaml` 中该 pane 有 `sessionId` 字段。
- 重启 Nexus server（保留 config）。
- pane 自动以 `claude --plugin-dir <…> --resume <sessionId>` 启动（无 task prompt）。
- pane 内部可以接着上次的对话往下问，model 看得到历史。
- `pkill claude && 重启 server`：pane 因外部死亡被识别，重新走 resume；新进程的 SessionStart hook 上报回来的 sessionId 与配置中的一致（Claude Code `--resume` 不会换 id）。
- 在 plugin 目录被人为删除的情况下：server 启动有 warn，pane 走非 plugin 模式（仍能用，但失去自动绑定）。
