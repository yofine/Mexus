# Mexus — AI Agent 多实例管理控制台

## 项目定位

Mexus 是一个**本地 Web 控制台**，用于在单个浏览器界面中同时管理多个 CLI AI Agent 实例（Claude Code、OpenCode 等）的并行协作。用户通过 `mexus` CLI 启动服务，自动打开浏览器进入管理界面。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Node.js 22+, Fastify 5, node-pty, chokidar, simple-git, js-yaml |
| 前端 | React 18, Vite 6, xterm.js, Zustand, Tailwind CSS v4 (CSS-first), shiki, cmdk |
| 构建 | pnpm monorepo, tsx (直接运行 TS) |
| 通信 | 单 WebSocket 连接多路复用 + REST API |

## 目录结构

```text
Mexus/
├── packages/
│   ├── server/src/           # 后端 (~1530 行)
│   │   ├── cli.ts            # CLI 入口 (mexus start/init/status/stop)
│   │   ├── index.ts          # Fastify 服务编排，启动所有子服务
│   │   ├── types.ts          # 全局类型定义
│   │   ├── pty/
│   │   │   ├── PtyManager.ts     # node-pty 生命周期，滚动缓冲区 (512KB/pane)
│   │   │   └── StatuslineParser.ts # 从 Claude Code 输出提取 JSON 元数据
│   │   ├── workspace/
│   │   │   ├── WorkspaceManager.ts  # 状态中心，Set-based 多客户端事件分发
│   │   │   ├── ConfigManager.ts     # YAML 配置读写，Agent CLI 自动检测
│   │   │   └── AgentsYamlWriter.ts  # 防抖写 .nexus/agents.yaml (500ms)
│   │   ├── ws/handlers.ts    # WebSocket 事件路由
│   │   ├── fs/FsWatcher.ts   # chokidar 文件树监听 (depth 5, 防抖 300ms)
│   │   ├── git/GitService.ts # simple-git diff + .git/index 监听 (防抖 1s)
│   │   └── history/          # 终端历史管理
│   │
│   └── web/src/              # 前端 (~2500 行)
│       ├── App.tsx           # 根组件，WebSocket→Store 事件路由
│       ├── types.ts          # 前端类型 (与 server 手动同步，无共享包)
│       ├── components/
│       │   ├── Layout.tsx         # 四栏布局 (Sidebar|AgentPanes|Editor|FileTree)
│       │   ├── Sidebar.tsx        # 左侧图标操作栏 (48px)
│       │   ├── AgentPane.tsx      # 单个 Agent 手风琴面板 (可折叠)
│       │   ├── Terminal.tsx       # xterm.js 封装
│       │   ├── BottomTerminal.tsx # 底部浮动 Shell (懒创建，agent='__shell__')
│       │   ├── EditorTabs.tsx     # 文件/Diff 标签页系统
│       │   ├── FileTree.tsx       # 递归文件树浏览器
│       │   ├── FileViewer.tsx     # Shiki 语法高亮代码查看器
│       │   ├── GitDiffPanel.tsx   # Git diff 展示 + 展开 hunks
│       │   ├── AddPaneDialog.tsx  # 新建 Agent Pane 弹窗
│       │   ├── CommandPalette.tsx # Cmd+K 命令面板 (cmdk)
│       │   ├── AgentIcon.tsx      # Agent 类型 SVG 图标
│       │   └── ResizeHandle.tsx   # 列拖拽分隔条
│       ├── stores/
│       │   ├── workspaceStore.ts     # Zustand 全局状态 (panes/tabs/files/diffs)
│       │   └── terminalRegistry.ts   # 全局 Map 终端写入注册表 (不走 React)
│       ├── hooks/
│       │   ├── useWebSocket.ts       # WS 连接 + 指数退避重连
│       │   └── useKeyboardShortcuts.ts # 全局快捷键
│       └── styles/globals.css        # 7 套主题 + CSS Variables + 响应式缩放
│
├── .nexus/
│   ├── config.yaml     # 项目级配置 (panes 定义，提交到 git)
│   ├── agents.yaml     # 运行时状态 (自动生成，gitignore)
│   └── history/        # 终端历史 (gitignore)
│
└── docs/               # 设计文档
```

## 核心架构

### 数据流

```text
浏览器 ←──WebSocket──→ Fastify Server
  │                        │
  │  terminal.input ──→    │──→ PtyManager.write(paneId, data) ──→ node-pty
  │  ←── terminal.output   │←── PtyManager.onData callback
  │                        │
  │  pane.create ──→       │──→ WorkspaceManager.createPane()
  │  ←── workspace.state   │      → PtyManager.spawn() → Shell → Agent CLI
  │                        │      → ConfigManager.save()
  │  ←── fs.tree           │←── FsWatcher (chokidar)
  │  ←── git.diff          │←── GitService (simple-git)
  │  ←── pane.meta         │←── StatuslineParser (Claude Code JSON)
```

### 关键设计决策

1. **Shell 套壳启动** — 不直接 spawn Agent CLI，而是先启动 shell，800ms 后发送命令。确保 .bashrc/.zshrc 环境变量正确加载。

2. **终端输出旁路 React** — `terminalRegistry.ts` 用全局 `Map<paneId, writeFn>` 存储 xterm 写入函数。WebSocket 数据直接写入 xterm，不经过 React state，避免高频输出导致的性能问题。历史缓冲区限制 10000 chunks。

3. **Set-based 多客户端事件** — WorkspaceManager 的每类事件维护 `Set<listener>`。每个 WebSocket 客户端连接时注册监听器，断开时只移除自己的，互不影响。

4. **agents.yaml 互感知** — 所有 Agent pane 的运行状态实时写入 `.nexus/agents.yaml`（防抖 500ms），Agent 可以读取此文件感知其他 Agent 的存在和状态。

5. **StatuslineParser** — Claude Code 的 statusline API 会在终端输出中插入 JSON 行。Parser 检测并提取 `model/session_id/cost_usd/context_used_pct` 等字段，从输出中剥离后广播为 `pane.meta` 事件。

6. **类型手动同步** — server 和 web 各有独立的 `types.ts`，没有共享包。修改协议时需同时更新两处。

## WebSocket 事件协议

```typescript
// Client → Server
'terminal.input'   // { paneId, data }
'terminal.resize'  // { paneId, cols, rows }
'pane.create'      // { config: PaneCreateConfig }
'pane.close'       // { paneId }
'pane.restart'     // { paneId, mode: 'continue'|'restart'|'manual' }
'git.refresh'      // {}
'broadcast.send'   // { groupId, message }

// Server → Client
'terminal.output'  // { paneId, data }
'pane.status'      // { paneId, status }
'pane.meta'        // { paneId, meta: { model, contextUsedPct, costUsd, ... } }
'pane.added'       // { pane: PaneState }
'pane.removed'     // { paneId }
'workspace.state'  // { state: WorkspaceState } (初始连接时发送)
'fs.tree'          // { tree: FileNode[] }
'git.diff'         // { diffs: FileDiff[] }
```

## 状态类型

```typescript
type AgentType  = 'claudecode' | 'opencode' | 'kimi-cli' | 'qwencode' | '__shell__'
type PaneStatus = 'running' | 'waiting' | 'idle' | 'stopped' | 'error'

// __shell__ 是底部浮动终端的特殊类型，在 UI 列表中过滤掉
```

## 配置体系

- **全局** `~/.nexus/config.yaml` — Agent CLI 定义（bin 路径、continue flag、env）、默认 shell、主题
- **项目** `.nexus/config.yaml` — 项目名、panes 列表（name/agent/workdir/task/restore）
- **运行时** `.nexus/agents.yaml` — 自动生成，pane PID/状态/元数据

## 主题系统

7 套内置主题通过 `data-theme` 属性切换，所有样式基于 CSS Variables：
- `dark-ide` (默认), `github-dark`, `dracula`, `tokyo-night`, `catppuccin`, `nord`, `light-ide`
- 响应式缩放：≥1600px (+15%), ≥1920px (+25%)

## 开发

```bash
pnpm install
pnpm run dev:full          # 前后端并行开发 (server:7700, vite:7701)
pnpm run dev               # 先构建前端，再启动 server (仅 7700)
NEXUS_PORT=8080 pnpm start # 生产模式，自定义端口
```

## 当前进度

- **已完成 (P0/P1)**: CLI、PTY 管理、终端交互、文件树、Git Diff、agents.yaml、多客户端 WS、statusline 集成
- **未开始 (P2)**: Review 评论→Agent、任务分发/广播、主题切换 UI
- **未开始 (P3)**: 历史回放、任务模板、Web 端配置编辑

## 编码约定

- Tailwind CSS v4 CSS-first 配置（无 tailwind.config.js），主题 token 定义在 `globals.css`
- 组件大量使用内联 style 而非 className
- 防抖间隔：AgentsYamlWriter 500ms, FsWatcher 300ms, GitService 1000ms
- PTY 滚动缓冲区上限 512KB/pane，前端历史缓冲区上限 10000 chunks
- `__shell__` pane 在 store 层面从 panes 列表中过滤，仅 BottomTerminal 使用

## UI 视觉与交互规范

### 产品气质

Mexus 是专业的多 Agent 本地执行控制台，不是营销型 SaaS。界面应优先体现：

- 高信息密度
- 清晰分割
- 低噪声状态表达
- 长时间工作可读性
- IDE / operator console 气质

视觉参考方向为近黑底、灰阶层级、细分割线、克制状态点和隐形操作按钮。避免大面积彩色、装饰性渐变、营销卡片感和过度圆角。

### 色彩

- 主背景使用黑色或近黑色：`#000`、`#050505`、`#070707`。
- 面板和卡片通过非常细的边界与轻微明度差分层，不依赖大色块。
- 品牌强调色统一使用绿色系，源自“刘念七”三字的 Unicode 色值推导：
  - `accent`: `#3CCFAB`，用于主按钮背景、活跃态指示点。
  - `accent-hover`: `#2AB89A`，用于主按钮 hover。
  - `accent-active`: `#239E85`，用于主按钮 active。
  - `accent-text`: `#5DDDC0`，用于强调文字、链接、关键数值。
  - `accent-muted`: `rgba(42, 184, 154, 0.12)`，用于选中行背景、输入框聚焦光晕。
  - `accent-subtle`: `rgba(42, 184, 154, 0.06)`，用于列表项 hover 背景。
  - `fg-on-accent`: `#0F0F0F`，用于强调色背景上的文字。
- 主按钮必须使用 `accent` 背景和 `fg-on-accent` 文字；输入框 focus 使用 `accent` 边框和 `accent-muted` 外发光；选中/活跃态使用 `accent-muted` 背景和 `accent` 边框。
- 不要在大面积区域使用品牌强调色做背景；品牌色只用于点缀、状态和关键交互。
- 默认文字使用灰阶层级：
  - 主标题接近 `#e7e5df`
  - 次级文字接近 `#b6b1a8`
  - 弱说明接近 `#8d887f` / `#817d74`
- 状态色必须克制：
  - 运行、停止等常规状态不使用高饱和红绿块。
  - 绿色只用于明确的当前连接、运行指示点等少量强状态。
  - 危险色仅用于错误或 destructive hover，不在默认状态大面积出现。

### 圆角

- 默认圆角应保持硬朗：`sm=2px`、`md=3px`、`lg=4px`。
- 除状态点、头像、图标容器等确有必要的视觉识别场景，不使用大圆角。
- 卡片、按钮、输入框、tab、面板都应使用低圆角或直角边界。

### 按钮层级

- 不要把所有按钮都做成隐藏按钮。
- 重要按钮和页面逻辑层级较高的按钮必须保留明确轮廓：
  - primary：Save、Create、Start、Run、Confirm 等页面主动作，使用实体背景或高对比描边。
  - secondary：Close、Cancel、Edit、Add、Test 等次级动作，使用细边框和轻背景。
  - quiet / invisible：只用于卡片底部、列表行尾、工具栏图标、低频 destructive 等低层级操作。
- 隐形按钮默认透明，但必须保留点击区域；hover/focus 时显示轻背景和细边框。
- Destructive 操作默认不大面积使用危险色；低层级 destructive 默认灰阶，hover 时使用弱危险色。确认型 destructive 仍应有明确按钮轮廓。
- 同一 action group 内不要混用明显按钮和纯文字按钮，应按层级统一为 primary / secondary / quiet。

### 分割与层级

- 优先使用 1px 分割线、细边框、内部分区表达结构。
- 卡片可采用 header / content / action 三段式：
  - header 放主对象名与轻状态
  - content 放路径、描述、meta
  - action 放低权重操作
- 分割线颜色应低对比，接近 `#22211f`、`#2b2925` 或 token 化后的边界色。
- 不使用厚重阴影作为主要层级手段。

### Hub 页面规范

- Hub logo 副标题使用 `Multi-agent execution`。
- Hub dashboard 使用黑底和近黑面板，风格与参考稿一致。
- Hub 实例卡片不展示内部技术概念，例如 connected/current/Active。
- Hub 卡片只展示用户可理解的信息：
  - project name
  - port
  - running/stopped/error
  - cwd
  - pid
  - started
- Hub 卡片顶部右侧使用 `:port + status` 的轻量文字状态，不使用堆叠 badge。
- Hub 卡片底部操作使用隐形按钮：
  - 默认透明背景、透明边框、保留点击区域
  - hover/focus 时才显示轻背景和细边框
  - destructive 操作默认灰阶，hover 时才显示弱危险色
- Hub 页面级操作，例如 Settings、Create server、Start server，应使用 primary 或 secondary 按钮，不套用 Hub 卡片底部的隐形按钮样式。

### Pane 区域规范

- Hub 模式和 Workspace 模式的 Pane 区域后续应统一，以 Hub 模式为基准。
- Workspace 模式不应保留独立左侧 icon sidebar。
- Pane 展开应占满 Pane 列可用空间。
- 当一个 Pane 展开时，其他 Pane 收成一行堆叠在上下两侧。
- 收起 Pane 行 hover 时可展示描述，点击后切换为展开 Pane。
- Pane 卡片只展示现有真实数据，不引入不可靠或尚未落地的字段。
- Agent 色用于 Pane 归属或 Agent 身份，不用于普通运行状态大面积染色。

### Team 面板规范

- Team 面板避免不可靠统计数字。
- Mission Agents 不应塞进窄侧栏，需要单独成行展示。
- Overview 只展示可信、已有数据支撑的信息。
- Team 面板整体应使用与 Hub 一致的黑底、细分割、灰阶信息层级。

### 文件树规范

- 文件树目标方案倾向直接采用 `trees.software` / `@pierre/trees`。
- 文件树应支持 compact density、路径优先 identity、Git 状态、键盘导航和大仓库性能。
- 视觉上保持 IDE 风格：高密度、低噪声、少色彩。

### Review 规范

- Review 体验先不新增功能。
- 该功能使用频次低，优先做视觉收敛和现有体验清理。
- 不为 Review 引入重型新流程或复杂统计。

### UI Kit 使用

- 共享组件优先放在 `packages/web/src/components/ui`。
- 优先使用现有 UI primitives，避免在业务组件中重复写局部按钮、badge、tab、toolbar、empty、loading、error 样式。
- UI kit 组件应尽量保持 presentational，不引入业务行为。
- 不全量引入 shadcn/ui；可以参考 Radix primitives 和 shadcn API 思路，但视觉必须保持 Mexus 自有控制台风格。
