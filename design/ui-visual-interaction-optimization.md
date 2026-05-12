# Mexus UI 视觉与交互体验优化方案

## 背景

Mexus 当前已经具备多 Agent 执行、终端、文件树、Diff Review、Hub、Replay、Mission 等核心能力。UI 也已有主题变量、状态色、基础按钮组件和 Mexus 品牌方向，但整体仍处在“功能界面可用，设计系统未完全收敛”的阶段。

本方案目标不是把 Mexus 做成通用 SaaS 风格，而是强化它作为 **多 Agent 执行操作台** 的专业体验：高信息密度、状态清晰、交互稳定、视觉统一、适合长时间使用。

## 总体目标

- 建立稳定的 UI token、组件和交互规范，减少内联样式和局部样式分叉。
- 统一 Workspace、Hub、Settings、Team、Replay 等界面的视觉语言，尤其统一 Hub 模式和 Workspace 模式的 Pane 区域。
- 强化 Pane 和文件树这些高频核心工作流的操作效率和信息层级。
- 保持 IDE / operator console 气质，不引入过度营销化或装饰化视觉。
- 为后续多 Agent 协作、Observer、Review 决策、任务编排能力预留一致的 UI 承载方式。

## 设计方向

Mexus 的 UI 应该围绕以下关键词展开：

- **控制台感**：结构清晰、边界明确、状态可见。
- **IDE 感**：文件、终端、Diff、任务面板都应该低噪声、高密度。
- **多 Agent 感**：Agent 颜色、身份、状态、工作区应贯穿多个界面。
- **可审查性**：用户能快速判断变更来自谁、风险在哪里、下一步该做什么。
- **可持续扩展**：新增模块应复用现有组件，而不是继续追加内联样式。

参考图只作为视觉风格参考，不作为功能形态或信息架构参考。Mexus 不应照搬参考产品的 workspace rail、右侧 changes panel、顶部账户区等具体结构。可借鉴的是更硬朗的视觉语言：

- 更低的圆角：主面板、tab、输入框、按钮以 2-6px 为主，避免大圆角和柔和卡片感。
- 更强的分隔线：用细线和暗面区分区域，而不是用大阴影或大色块。
- 更克制的色彩：默认暗色、低饱和、少量高亮；Agent 色只在需要识别时出现。
- 更硬的控件语言：tab、toolbar、segmented control、badge 都应偏紧凑、直线、低装饰。
- 更终端化的信息密度：界面允许密集，但要通过对齐、分组和层级保持可读。

## shadcn/ui 使用决策

不建议全量引入 shadcn/ui。推荐路线是：

**自有 UI Kit + Radix primitives + shadcn 组件 API 思路参考。**

原因：

- 当前项目已有 Tailwind CSS v4 CSS-first、CSS variables、多主题系统和自定义 IDE 风格组件。
- shadcn 默认视觉更偏通用应用 UI，直接套用会削弱 Mexus 的控制台气质。
- 全量迁移成本较高，会牵连 Button、Dialog、Tabs、Select、Command、Tooltip、Card 等大量界面。
- Mexus 当前最缺的不是组件数量，而是 token、状态、布局和交互规范的统一。

建议：

- 继续维护 `packages/web/src/components/ui` 作为自有 UI Kit。
- 对复杂交互使用 Radix primitives，例如 Dialog、Tooltip、Popover、DropdownMenu、Tabs、Select。
- 视觉层仍然完全使用 Mexus 自己的 CSS variables。
- 可借鉴 shadcn 的组件拆分、variant API、`cn()` 组合方式，但不直接照搬默认样式。

## UI 规范底座

### Token 体系

当前已有背景、文字、状态、Diff、终端、字号、间距、圆角等变量，但存在少量使用了未定义 token 的情况。应补齐并语义化：

- 背景：`--bg-base`、`--bg-surface`、`--bg-elevated`、`--bg-overlay`、`--bg-primary`、`--bg-secondary`
- 边框：`--border-subtle`、`--border-default`、`--border-strong`
- 文本：`--text-primary`、`--text-secondary`、`--text-muted`、`--text-code`
- 状态：`--status-running`、`--status-waiting`、`--status-idle`、`--status-error`、`--status-warning`
- Agent：保留 pane index 色板，用于 Agent 归属，而不是 agent type 色。
- 风险：冲突、阻塞、可发布、重大变更应有独立语义。

### 基础组件

优先补齐以下组件，并逐步替换内联样式：

- `Button`
- `IconButton`
- `Tooltip`
- `Badge`
- `StatusDot`
- `PanelHeader`
- `DialogShell`
- `Tabs`
- `Toolbar`
- `EmptyState`
- `ErrorBanner`
- `InlineNotice`

组件规范：

- 所有可点击元素必须有 hover、active、disabled、focus-visible。
- 图标按钮必须有 `aria-label` 和 tooltip。
- 圆角默认不超过 `--radius-lg`，且主界面优先使用 `--radius-sm` / `--radius-md`；卡片保持克制，不做过度圆润。
- 所有按钮、输入框、tab、badge 都使用 token，不直接写硬编码颜色。

按钮层级规范：

- 重要按钮和页面逻辑层级较高的按钮必须保留明确按钮轮廓，不能全部做成隐藏按钮。
- Primary action：用于 Save、Create、Start、Run、Confirm 等页面主动作；可以使用实体背景或高对比描边，必须一眼可识别。
- Secondary action：用于 Close、Cancel、Edit、Add Provider、Test Connection 等局部或次级动作；保留细边框和轻背景。
- Quiet / invisible action：仅用于卡片底部、列表行尾、工具栏图标、低频 destructive 等低层级操作；默认透明，hover/focus 时显示轻背景和细边框。
- Destructive action：默认不大面积使用危险色；低层级 destructive 可默认灰阶，hover 时显示弱危险色。确认性 destructive 操作仍应有明确按钮轮廓。
- 同一 action group 内不要混用“明显按钮”和“纯文字按钮”；应按层级统一为 primary / secondary / quiet。

## 核心体验优化

### 1. Pane 区域

Pane 是 Mexus 的核心对象。当前 Pane 展开高度受限，列表和卡片样式仍偏基础，应重点优化。

#### Hub 与 Workspace 统一

当前 Hub 模式和 Workspace 模式的 Pane 区域是两套 UI。后续应以 **Hub 模式的 Pane 区域为基准** 做统一，Workspace 模式不再保留独立左边栏。

调整方向：

- Workspace 模式移除左侧 icon sidebar。
- Pane 创建、Replay、Notes、Settings 等入口并入统一 topbar、Pane header 或 Command Palette。
- Hub 模式和 Workspace 模式使用同一套 Pane 列、Pane header、过滤/操作入口和空态。
- Workspace 模式只是不显示 Hub 的实例 tab rail，不再保留另一套 Pane 视觉结构。
- 统一后，用户在 Hub 内打开 workspace 与直接进入 workspace 的操作体验应一致。

#### 展开行为

建议将 Pane 展开模式调整为“占满 Pane 列可用空间”：

- 同一时间仍默认只展开一个 Pane。
- 展开的 Pane 应占满左侧 Pane 列剩余高度，而不是固定 `clamp(300px, 60vh, 800px)`。
- 未展开 Pane 收成一行，堆叠在展开 Pane 的上方和下方。
- 鼠标划过收起行时展开描述信息，例如任务摘要、workdir、branch。
- 点击收起行后，该 Pane 展开并占满 Pane 列可用空间。
- 当用户切换 Pane 时，终端区域平滑切换，但不做重动画。
- Hub mode 和普通 workspace mode 应保持一致。

可选模式：

- **默认模式：聚焦单 Pane**  
  展开 Pane 占满空间，适合主要工作流。
- **紧凑列表模式：多 Pane 总览**  
  所有 Pane 都以卡片列表展示，仅显示状态、任务、分支、diff 数量。
- **分组模式：按 Mission / Agent / Worktree 分组**  
  适合 Pane 数量较多时使用。

#### Pane 列表排布

Pane 列表需要从“折叠手风琴”升级为更精致的执行单元列表：

- 每张 Pane 卡片左侧使用 Agent 归属色条或色点。
- 主标题显示 Pane name，副标题显示 Agent 类型和任务摘要。
- 只展示当前已有实际数据支撑的字段：status、agent type、task、mission、workdir、branch、ctx、cost、changed files。
- 不新增尚未落地或低可信的功能型字段，例如 release-safe、blocked、风险分类等。
- 高优先级信息只来自现有状态：error、waiting、changed files、worktree。
- 次要 meta 过长时截断，hover tooltip 显示完整内容。
- Pane 卡片内的低层级操作按钮默认弱化，hover 或选中时增强，减少视觉噪声；创建、保存、启动等页面级动作仍必须保留明确按钮轮廓。

#### Pane 卡片视觉

建议视觉结构：

```text
┌──────────────────────────────┐
│ ● Auth Refactor       running │
│   Claude Code · worktree      │
│   feature/auth · 3 files      │
│   [ctx 42%] [$0.123] [review] │
└──────────────────────────────┘
```

展开时：

```text
┌──────────────────────────────┐
│ Header: identity + status + actions
├──────────────────────────────┤
│ Terminal fills remaining height
└──────────────────────────────┘
```

收起堆叠行：

```text
● Auth Refactor  Claude Code  waiting  feature/auth  3 files
```

hover 展开描述：

```text
● Auth Refactor
  Claude Code · waiting · feature/auth
  Task: Refactor auth middleware and update tests...
```

### 2. 文件树

文件树是 IDE 体验的关键，应显著优化。建议直接采用 `trees.software` / `@pierre/trees` 作为文件树基础，而不是继续扩展现有简易树实现。

可借鉴能力：

- path-first identity：所有选择、焦点、重命名、拖拽、搜索都基于 canonical path。
- flatten empty directories：单子目录链合并展示，减少无意义层级。
- Git status decoration：文件显示 modified、added、deleted、renamed、untracked；有变更后代的目录显示 dot。
- built-in virtualization：大文件树只渲染可见行，保证性能。
- keyboard navigation：方向键、Enter/Space、type-ahead、Tab 焦点管理。
- density control：compact/default/relaxed。
- icon sets：最小、标准、完整三档图标密度。
- search modes：隐藏不匹配、折叠不匹配、展开匹配。
- context menu：新建文件、新建目录、重命名、删除、复制路径、在终端中打开。

Mexus 的文件树优化建议：

- 默认使用 compact density，符合操作台信息密度。
- 支持空目录链压缩，例如 `src/components/ui/button.tsx` 中间无分叉目录可合并。
- 文件和目录加入 Git 状态标识。
- 文件树搜索固定在顶部，支持路径搜索。
- 当前打开文件、Agent 正在操作文件、Review 涉及文件应有不同视觉标识。
- 与 Activity / Review 联动：有 Agent 活动的文件显示 Agent 色点。
- 支持键盘导航和 type-ahead。
- 对大型仓库引入虚拟滚动。

采用 `@pierre/trees` 的判断：

- 优点：能力完整，文件树交互和可访问性基础强。
- 优点：基于 CSS variables / Tailwind 友好，适合接入 Mexus 的主题系统。
- 优点：虚拟滚动、搜索、Git 状态、键盘导航、图标、density、context menu 等能力已经完整覆盖 Mexus 的文件树需求。
- 风险：当前库处于 beta，API 可能变化；需要适配 Mexus 的文件节点结构、Git 状态、主题系统和打开文件行为。
- 推荐：直接以 `@pierre/trees` 为目标方案做技术 spike，除非 spike 发现明显阻塞，否则不再投入自研文件树增强。

### 3. CLI Agent 官方图标

当前 Agent 图标多为自绘或通用符号。建议引入官方或接近官方的 Agent 品牌图标，以增强识别效率。

原则：

- 图标用于识别 Agent 类型，Agent 归属色仍使用 pane index 色。
- 官方图标不作为状态色，不参与风险表达。
- 图标应提供单色/弱彩版本，避免破坏主题一致性。
- 无法安全使用官方资产时，使用本地抽象图标并保持一致风格。

建议覆盖：

- Claude Code / Claude
- Codex / OpenAI
- OpenCode
- Kimi Code
- Qoder CLI
- Gemini
- Aider
- Cursor
- Shell

落地方式：

- 新增 `AgentBrandIcon`，负责 agent type 到图标的映射。
- 保留 `getPaneColor` 作为 pane 实例归属色。
- 图标资源优先采用 SVG component，统一尺寸和颜色策略。
- 对版权或品牌不确定的图标，记录来源和使用约束。

### 4. Hub 体验

Hub 当前像独立 Dashboard，需要与 Workspace 统一。

优化方向：

- Hub 顶部 tab rail 与 Workspace Editor Tabs 使用同一视觉语言。
- Instance card 复用统一 Card、Badge、Button、StatusDot。
- Dashboard 右侧 “New execution server” 在窄屏下变为顶部或底部表单。
- Running / stopped / connected 三种状态视觉区分更清晰。
- Disconnected tab 的恢复动作更明确：Start、Remove、Close Tab。
- Hub 与 Workspace 的品牌、副标题、连接状态使用同一 topbar 模式。

### 5. Review 体验

Review 当前使用频次较低，未来随着更自动化的 Agent 工作流成熟，人工 Review 面板的使用频次可能进一步下降。因此本轮 UI 优化不把 Review 作为重点，不新增重功能。

本轮只做低成本一致性整理：

- 使用统一 Button、IconButton、PanelHeader、Badge。
- 保持现有 Diff 浏览、stage/unstage、commit/push、行级 comment 能力。
- 不引入 release-safe、major-change、blocked、风险分类、Review 导出等新概念。
- 保持 Review 入口可见但不抢占核心工作流。

### 6. Command Palette 与快捷操作

Command Palette 应成为高频操作入口。

优化方向：

- 命令按 Workspace、Pane、Git、Review、Hub、Theme 分组。
- 当前上下文相关命令置顶，例如当前 Pane 可 Restart、Close、Open Review。
- 增加 fuzzy search 结果高亮。
- 统一 keyboard focus、selected、empty state。
- Theme 切换从纯文本列表升级为带预览的命令或跳转 Settings。

### 7. Team 面板

Team 面板当前承载 Mission 观察能力，包括 Mission selector、overview、Kanban、Mission Agents、onboarding 和 parser fallback。它是多 Agent 协作的状态面板，不应该被设计成另一个项目管理系统。

本轮优化目标：

- 让 Team 面板更像 Mexus 操作台的一部分，而不是一块独立文档预览区。
- 强化 Mission 状态、任务进度、Agent 分工三类信息的层级。
- 与 Pane 区域共享 Agent 视觉语言，便于用户理解“Team Agent”和实际执行 Pane 的关系。
- 保持 Markdown-backed Mission 的轻量特性，不引入拖拽任务、复杂权限、自动调度等新功能。

#### 布局建议

Team 面板建议采用纵向分区布局，避免把 Mission Agents 挤进右侧窄栏：

```text
┌────────────────────────────────────────┐
│ Mission selector / current mission      │
├────────────────────────────────────────┤
│ Mission overview                        │
├────────────────────────────────────────┤
│ Mission Agents full-width row           │
├────────────────────────────────────────┤
│ Kanban columns                          │
│ To Claim / In Progress / Done           │
└────────────────────────────────────────┘
```

宽屏下：

- Overview 固定在顶部，只展示可靠的 mission 元信息。
- Mission Agents 单独占一整行，横向排列或换行，不挤入窄侧栏。
- Kanban 占主要高度，三列展示任务流。

窄屏下：

- Overview 保持顶部。
- Mission Agents 和 Kanban 上下排列。
- 过滤器收缩为一行或折叠进 toolbar。

#### Mission Overview

优化方向：

- 使用统一 `PanelHeader`、`Badge`、`StatusDot`。
- lifecycle 使用现有状态：active、completed、inactive、incomplete、unknown。
- intent 文本最多显示 2-3 行，长内容可展开。
- Overview 不展示不可靠统计数字；除非数据直接来自已成功解析的 kanban/agents 结果，并且语义明确。
- 可展示的可靠信息限于：mission name、lifecycle、date/createdAt、path、intent、missing files、parser status。
- parser error / incomplete mission 使用统一 `InlineNotice`，不使用硬编码橙色。

#### Kanban

当前 Kanban 已有状态列、agent/status filter、搜索、open source。应保留这些真实能力，优化视觉和密度：

- 三列保持：To Claim、In Progress、Done。
- Column header 使用统一计数格式，例如 `In Progress 2/5`。
- Task card 只显示现有字段：ref、to/from、scope、request、updated、review indicator。
- Task card 默认紧凑，hover 时展示更完整 request 或 source action。
- `Open kanban.md line` 操作改为统一 icon button + tooltip。
- 搜索和筛选放入 Team toolbar，避免压缩 Kanban 本体高度。
- 空列使用轻量 empty row，不使用大块空态卡片。

不做：

- 不做拖拽改状态。
- 不做任务编辑表单。
- 不做任务优先级、估时、标签体系。
- 不做自动任务分配。

#### Mission Agents

Mission Agents 内容通常放不进侧栏，应单独作为 Team 面板中的一整行。它的职责是展示“有哪些 Mission Agent，以及各自负责什么”，不是做详细工作台。

优化方向：

- 使用横向 agent row/card，空间不足时自然换行。
- 头像优先显示 Agent 名首字母，未来可与 Pane Agent 图标/颜色关联。
- 展示可靠字段：name、responsibility。
- taskCounts 只有在当前 parser 能稳定提供且语义可信时才展示；否则不显示统计数字。
- 如果 Mission Agent 已经有对应执行 Pane，可在未来用 pane color 做弱关联；本轮不强依赖新增数据。

#### Onboarding / Empty State

当前 onboarding 信息量偏大，适合作为第一次引导，但不应占据过多操作台空间。

优化方向：

- 使用统一 `EmptyState` 和 `InlineNotice`。
- Preview 区域保持低透明，但减少装饰感。
- Enable Agent Team banner 与普通 empty state 视觉统一。
- 文案聚焦“需要哪些 Mission 文件”和“下一步怎么启用”，不要长篇解释系统理念。

#### Parser Fallback

Parser fallback 是实用功能，应保留但视觉收敛：

- 使用 `ErrorBanner` 或 `InlineNotice` 显示 parse error。
- raw markdown fallback 放入等宽代码区。
- 提供 open source 按钮。
- 不新增复杂修复向导。

### 8. Dialog 与设置页

Add Pane Dialog、Settings、Notes、Mission Create 等弹层需要统一。

规范：

- 使用统一 `DialogShell`。
- Header 包含 title、subtitle、close。
- Footer 固定主操作和次操作。
- Esc 关闭，Tab 焦点不逃逸。
- 表单错误显示在字段附近，整体错误显示为 `ErrorBanner`。
- 危险操作需要 confirm 或明确 undo 反馈。

Add Pane Dialog 优化：

- Agent 类型选择使用官方图标 + 安装状态。
- Mission Agent、Start Mode、Isolation、YOLO 分组更清楚。
- Resume Session 列表支持搜索和排序。
- Workdir 可从文件树/最近路径选择。

## 视觉规范建议

### 色彩

- 默认主题继续保持 dark IDE 风格。
- accent 只用于主操作、焦点、选中态，不泛滥使用。
- Agent 颜色用于“谁在做”，状态颜色用于“发生了什么”，风险颜色用于“是否需要注意”。
- Git diff 颜色保持低饱和，避免长时间阅读疲劳。
- 背景层级应更硬朗：`base` 接近黑色，`surface/elevated` 只做轻微抬升，避免大面积柔和渐变。
- 顶栏、tab rail、相邻内容区域使用清晰边线划分，减少浮动卡片和阴影。

### 字体

- UI 字体用于标题、按钮、表单、状态。
- Mono 字体用于路径、branch、session id、cost、ctx、命令。
- 不使用负 letter spacing。
- 大屏不盲目放大所有字号，保持信息密度。

### 密度

- 默认密度偏 compact。
- Settings、Dialog 可使用 default density。
- 文件树、Pane 列表、Team Kanban、Review 文件列表、Activity 列表使用 compact density。
- 未来可在 Settings 中增加 density 选项。
- 主工作区尽量减少独立卡片容器，优先使用 panel、row、tab、toolbar 组织信息。

### 形态

- 顶部导航采用硬朗 topbar：高度固定、边界清楚、搜索/命令入口居中或靠左。
- Tab 采用直角或小圆角标签，active 状态用背景和底/顶边线表达。
- 卡片仅用于 Pane、Mission Agent、任务项等重复实体；卡片内部减少阴影，依靠边框和背景层级。

### 动效

- 只使用轻量动效：hover、focus、展开收起、Dialog enter。
- 终端、文件树、Diff 不做复杂动画，避免影响性能和注意力。
- 展开 Pane 时可使用高度/布局过渡，但必须保证终端 resize 稳定。

## 响应式策略

Mexus 是桌面优先产品，但不能在窄屏完全失控。

- 宽屏：Pane + Editor + Files + Bottom Terminal；Workspace 模式不再保留左侧 icon sidebar。
- 中宽：Files 可折叠，Pane 宽度可切换预设。
- 窄屏：Pane / Editor / Files 采用 tab 或 drawer 切换。
- Hub dashboard：双栏变单栏。
- Dialog：最大高度内滚动，footer 保持可见。
- Bottom Terminal：支持 collapsed、normal、maximized。

## 可访问性要求

- 所有 icon-only button 必须有 `aria-label`。
- Tooltip 不替代 accessible name。
- Dialog 需要 focus trap。
- 文件树使用 tree/treeitem 语义或等价 keyboard model。
- focus-visible 必须明显。
- 状态不能只靠颜色表达，关键状态应配合文字或图标。

## 分阶段实施

### P0：规范止血

目标：停止视觉和交互继续分叉。

- 补齐缺失 CSS token。
- 统一 Button、IconButton、Badge、StatusDot、PanelHeader、EmptyState。
- 替换明显重复的内联按钮和 header。
- 统一 hover、focus-visible、disabled。
- 修复未定义变量、硬编码圆角、硬编码状态色。

验收：

- 新增页面不需要再手写基础按钮样式。
- Workspace 主要 header 样式来自统一组件。
- 图标按钮具备 tooltip 和 aria-label。

### P1：核心工作流升级

目标：提升日常使用效率。

- 以 Hub 模式 Pane 区域为基准，统一 Hub 和 Workspace 的 Pane UI。
- Workspace 模式移除左侧 icon sidebar，将入口迁移到 topbar、Pane header 或 Command Palette。
- Pane 展开占满 Pane 列。
- Pane 收起项以一行堆叠在展开 Pane 上下两侧，hover 展开描述，点击切换展开。
- Pane 列表和卡片视觉重构，但只展示现有真实字段。
- 文件树替换为 `@pierre/trees`，接入 compact density、Git 状态、搜索、Agent 活动标识。
- Hub 与 Workspace 共用 tab/card/button/status 规范。
- Add Pane Dialog 和 Command Palette 统一弹层体验。

验收：

- 用户能快速判断每个 Pane 的状态、任务、变更和风险。
- 文件树可快速定位文件和变更。
- Hub 看起来属于同一个产品系统。

### P2：体验完善

目标：完善低频界面的一致性，不扩展不切实际的新功能。

- Review 面板只做视觉一致性整理。
- Team 面板优化布局层级、Kanban 密度、Mission Agents 列表和 parser fallback 视觉。
- Replay、Notes 等界面复用统一组件。
- Command Palette 增强上下文命令组织。
- Settings 增加密度等 UI 偏好入口时，再接入对应 token。

验收：

- 低频界面不再显得像独立样式分支。
- 没有引入缺少真实数据支撑的新 UI 概念。

### P3：质量保障

目标：让 UI 规范长期可维护。

- 增加视觉回归截图测试。
- 覆盖 Workspace、Hub、Settings、Add Pane、Team、Review、Bottom Terminal。
- 建立 `UI Design Guidelines` 文档。
- 新增组件必须走 UI Kit。
- 新增交互必须有 keyboard 和 focus 状态。

## 技术落地建议

建议目录：

```text
packages/web/src/components/ui/
  button.tsx
  icon-button.tsx
  tooltip.tsx
  badge.tsx
  status-dot.tsx
  panel-header.tsx
  dialog-shell.tsx
  tabs.tsx
  empty-state.tsx
  error-banner.tsx
```

样式策略：

- 继续使用 CSS variables。
- 通用组件样式放在 `globals.css` 或拆分为 UI 专用 CSS。
- 复杂业务组件保留局部 class，但不再内联基础视觉样式。
- 对于 Radix 组件，仅使用其行为和可访问性，不采用第三方默认视觉。

文件树技术 spike：

- 以直接采用 `@pierre/trees` 为目标，评估与现有 `FileTree.tsx` 的替换成本。
- 验证 Git 状态、Agent 活动标识、打开文件、搜索、虚拟滚动。
- 验证 beta API 风险和 bundle 体积。
- spike 通过后替换现有文件树；只有出现明确阻塞时才考虑自研增强。

Agent 图标技术 spike：

- 确认各 CLI Agent 官方图标来源和许可。
- 建立本地图标映射。
- 对不确定资产使用抽象 fallback。

## 非目标

- 不做整站营销页重设计。
- 不把 Mexus 改成通用 SaaS 风格。
- 不全量迁移到 shadcn/ui。
- 不在第一阶段重写全部组件。
- 不为 Pane 卡片和 Review 增加缺少现有数据支撑的新功能。
- 不把 Review 面板升级为复杂发布决策系统。
- 不改变 `.nexus`、API、WebSocket 协议或运行时配置结构。

## 成功标准

- Workspace、Hub、Settings、Team、Review 视觉上属于同一套系统。
- Hub 模式和 Workspace 模式的 Pane 区域使用同一套 UI，以 Hub 模式为基准。
- Workspace 模式不再保留左侧 icon sidebar。
- Pane 展开后能成为真正的主工作区，而不是局部小终端。
- Pane 收起项能以一行堆叠，hover 展开描述，点击切换为展开主 Pane。
- 文件树基于 `@pierre/trees`，接近现代 IDE 文件浏览体验，支持搜索、Git 状态、键盘导航和高性能渲染。
- Team 面板保持 Markdown-backed Mission 的轻量属性，同时具备清晰的 Overview、Kanban、Agents 信息层级。
- Agent 类型用官方或高识别度图标表达，Agent 实例归属用 pane color 表达。
- 80% 以上常见按钮、badge、header、empty state 来自 UI Kit。
- 新增功能无需复制粘贴内联样式。
- 用户能更快判断：谁在工作、改了什么、哪里有风险、下一步该做什么。
