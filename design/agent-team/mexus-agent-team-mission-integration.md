# Mexus Agent Team Mission Integration

## 1. 方案定位

本方案以项目内新增的 Skill 为唯一机制准绳：

```text
.claude/skills/agent-team-mission-workflow/
```

Mexus 集成目标不是重新设计一套 Agent Team 协作协议，也不是把 Mission Workflow 变成中心化运行时编排框架。Mexus 应把这套 Skill 产品化为可见、可创建、可观察、可恢复的工作台能力。

本设计全部基于 Mexus Hub 模式。这里的 Hub 模式指用户从 Hub 打开某个运行中的 Mexus workspace 后看到的 connected workspace view；方案不为非 Hub 的旧布局单独设计入口或交互分支。

核心原则：

- Markdown 文件仍是事实源。
- Skill 定义 Mission 文件结构、任务格式、角色规则和流转规则。
- Mexus 只提供辅助创建、解析展示、任务移动、Prompt 注入、Pane 启动和状态观察。
- Mexus 不替代 Agent 的判断，不自动改写任务结果，不默认引入调度器。
- 任何自动化能力都应能回落到直接编辑 Markdown。

## 2. 用户价值

Hub 模式下，Mexus 已经能在一个 workspace 视图里同时启动多个 CLI Agent pane，但用户仍需要手动维护复杂任务的分工、上下文恢复和验收关系。

集成 Mission Workflow 后，Mexus 应支持：

- 用户从一个复杂工程目标创建 Mission。
- Mexus 根据 Skill 模板生成 `agent-team/mission-workflow.md`、`agent-team/agents.md` 和 Mission 五件套。
- 用户可以在 UI 中看到当前 active Mission 的 Brief 概览、Kanban 和 Mission Agent 职责。
- 用户可以从 Mission 文件和 pane 启动提示恢复 Agent 身份。
- Agent 可以围绕 `kanban.md` 领取、完成、Review 任务。
- Mexus 可以把 Markdown Kanban 解析成任务板，但源文件仍可手动编辑。
- 会话丢失后，用户可以用 Activation Prompt 恢复某个 Mission Agent。

## 3. 文件模型

Mexus 应使用 Skill 中声明的默认路径：

```text
agent-team/
  mission-workflow.md
  agents.md
  missions/
    <mission-name>/
      mission.md
      agents.md
      kanban.md
      roundtable.md
      squad-lead.md
```

`.claude/skills/agent-team-mission-workflow/references/` 是初始化模板来源。

运行时不需要新增数据库。Mexus 可以缓存解析结果，但必须把 Markdown 视为唯一持久状态。

## 4. 产品入口

### 4.1 Hub Team Tab

Team/Missions 入口只设计为 Hub connected workspace view 中的固定 tab。

第一版应把 Agent Team 放进 Hub workspace 中间编辑区的活动面板 tab 体系中，作为一个固定 tab：

```text
Activity | Team | Review | Replay | Files...
```

原因：

- Hub connected workspace view 中，`Activity` / `Review` 已经是 workspace 级观察和协作入口。
- `Team` 与 Agent 活动、任务流转、Review 关系更近，应放在 Hub 的活动面板区域。
- Team 必须进入 Hub workspace 的 tab 工作区，作为 Hub connected workspace view 的一等观察面板。
- Team 面板需要占用中间主视图区展示 active Mission 的 Kanban、概览和 Agent 职责，tab 形态比弹窗更适合长期使用。

第一版面板包含：

- 顶部 Mission 选择器。
- 当前 Mission 概览。
- Kanban 任务板。
- Mission Agent 名字和职责说明。

Team 面板是观测区域，不是任务调度控制台。第一版应尽量避免加入过多操作能力，尤其不要在看板卡片或 Agent 区直接提供改写 Mission 状态、启动 Agent、发送 Prompt 的高频按钮。

Roundtable 第一版不放到 Team 面板中。文件仍然创建并保留在 Mission 目录里，但 UI 不把它作为主入口展示。

### 4.2 创建 Mission

用户点击 `New Mission` 后，Mexus 展示轻量表单：

- Mission name。
- 原始目标。
- 约束与验收标准。

第一版不需要让 Mexus 自动拆任务。Mexus 只负责生成模板和启动一个 Squad Lead pane，让 Squad Lead 根据 Skill 完成拆解。

生成动作：

1. 如果 `agent-team/mission-workflow.md` 不存在，从 Skill reference 复制。
2. 如果 `agent-team/agents.md` 不存在，从 Skill reference 复制。
3. 创建 `agent-team/missions/<mission-name>/`。
4. 从 Skill reference 创建五个 Mission 文件。
5. 将用户输入写入 `mission.md` 的初始 brief 区域。
6. 使用系统设置中的默认 CLI agent 类型创建 Squad Lead pane，并注入一段使用 Skill 的启动提示。

### 4.3 打开现有 Mission

Mexus 扫描：

```text
agent-team/missions/*/mission.md
```

只要五件套存在，即认为是完整 Mission。缺文件时标记为 incomplete，并提供 `Repair from templates` 操作。

## 5. UI 结构

### 5.1 Mission Selector

Hub Team 面板顶部是 Mission 选择器。

这里的 active Mission 是 Mission 生命周期状态，不是单纯的 UI 选中项。一个 Hub connected workspace 同一时间只能有一个生命周期上 active 的 Mission，否则多个 Agent Team 同时认为自己是当前主线，会让 Kanban、pane 归属、review backlog 和 Squad Lead 指挥关系混乱。

选择器负责：

- 展示当前生命周期 active Mission。
- 展示其他 inactive / completed Mission 供查看。
- 创建新 Mission。
- 激活某个 Mission，并在同一次写入中停用旧 active Mission。
- 标记 Mission 是否 incomplete。

生命周期状态建议持久化在仓库内 Mission 文件中，同时在 `.nexus/config.yaml` 保存当前 active Mission 的索引用于快速恢复。

`mission.md` 增加一个轻量状态字段：

```md
Lifecycle: active | inactive | completed
```

`.nexus/config.yaml` 保存当前 active Mission 名称：

```yaml
active_mission: <mission-name>
```

约束：

- 创建第一个 Mission 时，默认设为 `active`。
- 创建后续 Mission 时，如果用户选择激活新 Mission，Mexus 必须把旧 active Mission 改为 `inactive`。
- 如果用户不激活新 Mission，新 Mission 以 `inactive` 创建，只能作为历史或草稿查看。
- Mission 选择器的切换动作是 lifecycle activation，必须明确提示用户这会停用当前 active Mission。
- Mexus 通过创建 Mission 和激活 Mission 的写入流程约束单 active Mission，不增加额外异常状态模型。

### 5.2 Mission Overview

显示来自 `mission.md` 的概要信息：

- Mission 名称。
- 创建日期。
- 原始目标摘要。
- 最低验收标准。
- 当前 Kanban 数量摘要：`To Claim / In Progress / Done`。
- 未 Review 的 Done 数量。

概览放在 Mission 选择器下方，作为紧凑信息条或折叠区，不占用主视图空间。Mexus 第一版可以用 Markdown heading 和简单正则提取摘要；如果解析失败，退回到原文预览。

### 5.3 Kanban Board

Kanban 是 Team 面板的核心区域，应占据主视图最大空间。

Mexus 把 `kanban.md` 的三个状态解析为 UI 列：

```text
To Claim
In Progress
Done
```

任务块以 Skill 定义格式为准：

```text
To: Agent-X | From: Agent-Y | Scope: path/or/module
```

每张任务卡显示：

- `To`
- `From`
- `Scope`
- `Ref`
- `Request`
- `Acceptance`
- `Updated`
- `Review` 状态

第一版 Kanban UI 只做展示和定位，不做 Claim、Complete、Review 操作。

允许的低风险交互：

- 点击任务卡打开 `kanban.md` 对应任务位置。
- 按 Agent、状态、文本做前端过滤。
- 显示任务数量、未 Review 数量、更新时间。

任务状态流转仍由 Agent 或用户直接编辑 `kanban.md` 完成。Mexus 后续可以增加受控操作，但必须先证明不会把 Team 面板变成调度控制台。

### 5.4 Mission Agents

Agent 信息是 Kanban 之后的第二优先级。第一版只展示本次 Mission 的 Agent 名字和职责介绍，不展示完整全局 Agent Roster，也不提供操作按钮。

来源是 Mission 级 `missions/<mission>/agents.md`：

- Agent 名字。
- 本次 Mission 职责。
- Activation Prompt 摘要。
- Initial Prompt 摘要。
- 当前分配任务数量。

仓库级 `agent-team/agents.md` 仍然保留，用于 Squad Lead 复用长期 Agent 能力，但第一版 Team 面板不需要直接展示完整长期 roster。

### 5.5 Roundtable

Roundtable 第一版不放到 Team 面板中，也不作为 visible navigation。

原因：

- 当前主流程先围绕 Kanban 跑通。
- Roundtable 自由文本更强，过早结构化会限制实际使用。
- 第一版用户仍可从 File Tree 打开 `roundtable.md` 手动编辑。

第二版再支持：

- 在 Team 面板中增加 Roundtable 辅助区。
- 新建 review item。
- 记录 vote。
- 根据非弃权票计算 Approved。

## 6. Pane 集成

### 6.1 默认 CLI Agent 类型

系统设置增加 Mission 默认 CLI agent 类型：

```yaml
mission_defaults:
  agent_type: claudecode
```

该配置属于全局设置，放在 `~/.nexus/config.yaml`。它用于：

- 创建 Mission 时默认启动 Squad Lead pane。
- 后续从命令面板或其他入口恢复 Mission Agent pane。

Team 面板本身不提供 Agent 启动按钮。启动 pane 是执行动作，应放在创建 Mission 流程、命令面板、Agent pane 区域或后续专门的启动入口中，而不是混在观测面板里。

如果默认 CLI 未安装，创建 Mission 时提示用户去 Settings 选择可用 agent 类型。

### 6.2 Squad Lead Pane

创建 Mission 后，Mexus 自动创建一个 pane：

- name: `Squad Lead - <mission-name>`
- agent: 系统设置中的 Mission 默认 CLI agent 类型
- workdir: Hub 当前连接 workspace
- restore: `manual`
- task: 使用 Skill 的 Squad Lead 启动提示

启动提示应包含：

```text
Use the agent-team-mission-workflow skill.
You are Squad Lead for mission `<mission-name>`.
Read:
- agent-team/mission-workflow.md
- agent-team/agents.md
- agent-team/missions/<mission-name>/mission.md
- agent-team/missions/<mission-name>/agents.md
- agent-team/missions/<mission-name>/kanban.md
- agent-team/missions/<mission-name>/roundtable.md
- agent-team/missions/<mission-name>/squad-lead.md

Create or refine the mission squad, publish initial kanban tasks, and keep Markdown files as the source of truth.
Do not implement product code unless the user explicitly asks.
```

### 6.3 Mission Agent Pane

在 Hub connected workspace view 中创建 pane 时，如果 Hub 当前连接 workspace 有 active Mission，表单可以提供一个 `Mission Agent` 选择器。

选择器数据来自当前 active Mission 的 `agents.md`。用户选择某个 Mission Agent 后，Mexus 用该 Agent 的 Activation Prompt 和 Initial Prompt 填充 pane 表单：

Pane 命名建议：

```text
<AgentName> - <mission-name>
```

Pane task 应包括：

- 当前 agent name。
- mission path。
- required reading。
- 当前分配任务入口。
- Claim / Complete / Review 规则。

这个选择器属于 pane 创建流程，不属于 Team 面板中的 Agent 卡片操作。Team 面板仍只负责观察 Agent 名字、职责和任务数量。

### 6.4 Pane 与 Mission 的关联

需要在 `PaneConfig` 增加可选字段：

```ts
mission?: {
  name: string
  path: string
  role: 'squad-lead' | 'mission-agent'
  agentName?: string
}
```

这个字段只用于 UI 归类和恢复，不改变 CLI Agent 行为。

`.nexus/config.yaml` 中保存该字段，使 Mexus 重启后仍知道 pane 属于哪个 Mission。

Pane 卡片需要展示 mission 标记：

- mission name。
- mission role。
- mission agent name。

标记用于观测和筛选，不在卡片内提供 Mission 状态改写能力。

### 6.5 Pane 筛选与标题

Agent panes 列表需要支持筛选：

- 按 Mission 筛选：all / no mission / `<mission-name>`。
- 按 agent 类型筛选：all / `claudecode` / `codex` / `opencode` / 其他已配置 agent。

筛选是 UI 视图状态，不影响 pane 生命周期，也不改变 `.nexus/config.yaml` 中的 pane 定义。

Pane 支持改标题。标题编辑只更新 `PaneConfig.name` 和当前 `PaneState.name`，不改变 mission 归属、agent 类型、workdir、restore 或 task。

## 7. Server 能力

新增一个轻量服务：

```text
packages/server/src/mission/MissionService.ts
```

职责：

- 发现 Mission。
- 读取和保存 Mission lifecycle 状态。
- 在创建 Mission 和激活 Mission 时保证单 Hub connected workspace 最多只有一个 `Lifecycle: active` Mission。
- 从 Skill templates 初始化 Mission 文件。
- 读取 Mission 文件。
- 对 `kanban.md` 做保守解析。
- 返回解析错误和 fallback raw content。

不做：

- 不运行 Agent。
- 不调用模型拆任务。
- 不把 Team 面板变成任务调度器。
- 不校验所有 Markdown 格式。
- 不持久化第二份状态。

建议 REST API：

```text
GET  /api/missions
POST /api/missions
GET  /api/missions/active
POST /api/missions/:name/activate
GET  /api/missions/:name
POST /api/missions/:name/repair
PATCH /api/panes/:paneId/title
```

WebSocket 事件可后置。第一版用 REST + 文件 watcher 刷新即可。

### 7.1 Operator Note

Mission REST APIs are registered by both the per-workspace server and the Hub server. If a workspace server was already running before Mission routes were added, restart that workspace instance before expecting `/api/missions` to return Mission JSON; stale processes may fall through to the SPA fallback and return `index.html`.

The Hub server exposes read-only Mission discovery for the directory where `mexus hub` was started. Bare Hub `GET /api/missions` can list on-disk Missions, but bare Hub `POST /api/missions` is rejected with a message to connect to a workspace instance because Squad Lead pane creation belongs to a workspace process.

## 8. Web 能力

接入点应复用 Hub connected workspace view 中现有的编辑区 tab 系统：

```text
packages/web/src/stores/workspaceStore.ts
packages/web/src/components/EditorTabs.tsx
```

需要把 `EditorTab['type']` 增加 `team`，并在初始固定 tabs 中加入：

```ts
{ id: 'tab:team', type: 'team', label: 'Team', pinned: true }
```

`EditorTabs` 根据 `team` 类型渲染 `MissionPanel`。

新增组件建议：

```text
packages/web/src/components/missions/MissionPanel.tsx
packages/web/src/components/missions/MissionSelector.tsx
packages/web/src/components/missions/MissionOverview.tsx
packages/web/src/components/missions/MissionKanban.tsx
packages/web/src/components/missions/MissionAgents.tsx
```

新增 store slice：

```text
packages/web/src/stores/missionStore.ts
```

第一版不要把 Mission 状态塞进 `workspaceStore.ts`。Mission 是 Hub workspace 内的独立产品面板，保持边界清晰。

`workspaceStore.ts` 只保存 tab 的存在、顺序和激活状态；Mission 列表、active Mission、Kanban 解析结果、Mission Agent 摘要和加载状态放在 `missionStore.ts`。

`missionStore.ts` 中的 `activeMission` 表示生命周期 active Mission，不表示临时选中的列表项。若用户需要查看 inactive Mission，UI 可以进入只读预览模式，但不能把它标成 active，也不能让 pane 创建默认关联到它。

`MissionPanel` 的布局顺序：

1. `MissionSelector`
2. `MissionOverview`
3. `MissionKanban`
4. `MissionAgents`

Settings 需要增加 Mission 默认 CLI agent 类型配置，复用现有 agent 配置数据源展示可选项。

Hub workspace 的 pane 创建和列表区域需要配套增强：

- `AddPaneDialog` 增加 Mission Agent 选择器，仅在存在 active Mission 时显示。
- 选择 Mission Agent 后自动填充 pane name 和 task。
- `AgentPane` 卡片显示 mission badge。
- pane 列表增加 Mission filter 和 agent type filter。
- `AgentPane` 支持标题编辑，保存到 workspace config。

## 9. 与现有 Mexus 能力的关系

### 9.1 File Tree

Mission 文件仍在 Hub workspace 的文件树中可见。Team 面板只是提供结构化观察入口。

### 9.2 Agent Panes

Mission pane 仍是 Hub workspace 中的普通 pane。Mexus 只额外显示 mission badge 和 role 信息。

### 9.3 Activity / Review

现有 activity、diff、review 面板继续工作。Mission Review 指的是 Kanban 中的 publisher review，不等同于 Git diff review。

### 9.4 Worktree

第一版默认使用 Hub 当前连接 workspace 的 shared 工作区。Mission task 的 `Scope` 已提供协作边界。

后续可以让某些 Mission Agent pane 使用 worktree isolation，但这不应成为第一版默认路径。

## 10. 数据一致性

Markdown 是事实源会带来并发编辑问题。第一版采用低成本策略：

- 每次 UI 写入前重新读取目标文件。
- Team 面板不改写 Kanban 任务块。
- lifecycle activation 写入前扫描所有 Mission 的 `Lifecycle` 字段。
- 激活某个 Mission 时，同一操作中把旧 active Mission 改为 `inactive`。
- 创建 Mission 时显式决定新 Mission 是否成为 active；若成为 active，同一操作中停用旧 active Mission。
- 保留未知字段、空行和人工备注。

如果同一个 `Ref` 重复出现，Mexus 仍可展示任务，但不提供任何状态推断之外的自动修复。

## 11. 分阶段落地

### Phase 1: Hub Mission MVP

- 将 Skill 作为模板源。
- 支持 Mission 扫描和创建。
- 支持单 lifecycle active Mission。
- 增加 Hub Team tab。
- 展示 active Mission 概览、Kanban 和 Agent 职责。
- 增加 Settings 中的 Mission 默认 CLI agent 类型。
- 支持创建 Squad Lead pane。
- Add Pane 表单支持选择 active Mission agent 填充表单。
- pane 卡片展示 mission 标记。
- pane 列表支持按 Mission 和 agent 类型筛选。
- pane 支持改标题并持久化。
- Kanban 只读解析，不在 Team 面板改写任务状态。

验收：

- 用户能从 Mexus 创建一个完整 Mission 目录。
- Squad Lead pane 能带着正确提示启动。
- 文件树中能看到生成文件。
- 一个 Hub connected workspace 同一时间最多只有一个 lifecycle active Mission。
- 用户不打开 Markdown 也能在 Team tab 理解当前 Mission 状态。
- Kanban 是 Team 面板中最主要的工作区域。
- Team 面板中的 Agent 区只展示名字和职责，不提供启动或发送 Prompt 操作。
- Add Pane 表单能从 active Mission agent 填充 name 和 task。
- pane 卡片能显示 mission name、role 和 mission agent name。
- 用户能按 Mission 和 agent 类型过滤 panes。
- 修改 pane 标题后刷新 Mexus 仍保留新标题。
- Team 面板不改写 `kanban.md` 任务状态。

### Phase 2: Mission Dashboard

- 优化 Mission Overview 的摘要提取和折叠展示。
- 增加 inactive / completed Mission 的只读预览。
- 增加 Mission lifecycle 完成入口。
- 增加 Mission 文件跳转体验。

验收：

- 用户能在不改变 active Mission 的情况下查看历史 Mission。
- 用户能把 active Mission 标记为 completed。
- Team 面板能稳定跳转到对应 Markdown 源文件。

### Phase 3: Pane Mission Integration

- 增强 pane 筛选体验和默认筛选记忆。
- 增加 mission badge 的视觉密度优化。
- 支持从 pane 反向定位到 Mission Agent 和 Kanban 相关任务。

验收：

- 用户能快速看出每个 pane 属于哪个 Mission 和 Agent。
- 用户能从 pane 定位回 Team 面板对应 Agent 观察区。
- 筛选状态不会影响 pane 生命周期。

### Phase 4: Kanban Observation

- 支持 Kanban 只读观察、过滤和跳转到 Markdown 原文。
- 支持未 Review Done 任务提示。

验收：

- Team 面板不改写 `kanban.md` 任务状态。
- 手动编辑后 UI 能刷新并继续显示。
- 解析失败时不破坏原文件。

### Phase 5: Roundtable Assistance

- 在 Team 面板中增加 Roundtable 辅助区。
- 支持创建 Roundtable review item。
- 支持投票记录。
- 支持 Approved / Rejected 移动建议。

验收：

- Roundtable 仍可手动编辑。
- UI 能帮助记录关键决策，但不会阻塞 Kanban 主线。

## 12. 非目标

第一阶段不做：

- 自动拆解复杂任务。
- 自动调度多个 Agent。
- 自动判断任务完成。
- 在 Team 面板中启动 Agent 或发送 Prompt。
- 从 Team 面板 Agent 卡片启动 pane。
- 在 Team 面板中直接 Claim、Complete、Review Kanban 任务。
- 自动合并或发布。
- 自定义 Markdown schema 校验器。
- 强制所有 Agent 通过 API 移动任务。
- 用数据库替代 Markdown。

这些能力可以在 Mission Workflow 跑稳定后再考虑。

## 13. Mission Summary

Mission: `hub-agent-team-mission-mvp`

目标是在 Mexus Hub connected workspace view 中集成 Agent Team Mission Workflow，让用户可以基于仓库内 Markdown Mission 文件观察一个多 Agent 工程任务的生命周期、看板状态、Agent 职责和 pane 归属。

一期只做 Hub 模式，不为非 Hub 布局设计入口。Team tab 是观察区域，不是任务调度控制台。Mission 文件仍是事实源，Mexus 负责创建、解析、展示、生命周期约束、pane 关联和筛选。

一期完成后应满足：

- Hub workspace 有固定 `Team` tab。
- 用户可以从 Skill 模板创建 Mission。
- 一个 Hub connected workspace 同一时间最多只有一个 `Lifecycle: active` Mission。
- Team tab 展示 active Mission 的概览、Kanban 和 Mission Agent 职责。
- Kanban 在 Team tab 中只读展示，不提供 Claim、Complete、Review 操作。
- Settings 可以配置 Mission 默认 CLI agent 类型。
- 创建 Mission 后可以用默认 CLI agent 启动 Squad Lead pane。
- 创建 pane 时可以选择 active Mission 中的 Agent 来填充 pane 表单。
- pane 卡片显示 mission 标记。
- pane 列表支持按 Mission 和 agent 类型筛选。
- pane 支持改标题并持久化。

## 14. Phase 1 Development Tasks

### Task 1: Install Mission Skill Templates As Product Source

Scope:

- `.claude/skills/agent-team-mission-workflow/`
- server template resolution

Work:

- Treat `.claude/skills/agent-team-mission-workflow/references/` as the Mission template source.
- Add server-side path resolution for the Skill templates.
- Do not duplicate templates into another runtime directory.

Acceptance:

- Server can locate `mission-workflow.md`, `agent-roster-template.md`, `mission-template.md`, `agents-template.md`, `kanban-template.md`, `roundtable-template.md`, and `squad-lead-template.md`.
- Missing template errors are explicit and user-readable.

### Task 2: Add Mission Lifecycle Fields And Workspace Config Shape

Scope:

- `packages/server/src/types.ts`
- `packages/web/src/types.ts`
- `.nexus/config.yaml` serialization

Work:

- Add workspace config fields for:
  - `active_mission?: string`
  - `mission_defaults?: { agent_type?: AgentType }`
- Add pane mission metadata:
  - mission name
  - mission path
  - mission role
  - mission agent name

Acceptance:

- Existing workspace configs still load.
- New fields persist without dropping existing pane fields.
- Pane mission metadata survives Mexus restart.

### Task 3: Build MissionService

Scope:

- `packages/server/src/mission/MissionService.ts`
- server tests

Work:

- Discover Missions under `agent-team/missions/*`.
- Read Mission files.
- Create Mission files from Skill templates.
- Write `Lifecycle: active | inactive | completed` into `mission.md`.
- Enforce single active Mission during create and activate operations.
- Read and update `.nexus/config.yaml` `active_mission`.

Acceptance:

- Creating the first Mission makes it active.
- Creating a later active Mission sets the previous active Mission to inactive.
- Creating a later inactive Mission does not change the current active Mission.
- Activating a Mission updates lifecycle state and `active_mission`.

### Task 4: Add Mission REST APIs

Scope:

- `packages/server/src/index.ts`
- `packages/server/src/ws/handlers.ts` only if needed
- `packages/server/src/mission/*`

Work:

- Add:
  - `GET /api/missions`
  - `POST /api/missions`
  - `GET /api/missions/active`
  - `POST /api/missions/:name/activate`
  - `GET /api/missions/:name`
  - `POST /api/missions/:name/repair`

Acceptance:

- APIs return structured Mission summaries and raw fallback content when parsing is partial.
- API writes never replace Kanban task blocks.
- Invalid Mission names cannot escape the workspace path.

### Task 5: Add Mission Default CLI Agent Setting

Scope:

- `packages/server/src/workspace/ConfigManager.ts`
- `packages/web/src/components/SettingsDialog.tsx`

Work:

- Add Settings UI for Mission default CLI agent type.
- Reuse existing configured agent definitions as options.
- Validate that the selected agent type is available before creating Squad Lead pane.

Acceptance:

- User can pick the default Mission CLI agent in Settings.
- The setting persists in global config.
- Mission creation warns if the configured CLI is unavailable.

### Task 6: Create Squad Lead Pane From Mission Creation

Scope:

- Mission creation flow
- `WorkspaceManager.createPane`

Work:

- On Mission creation, create a Squad Lead pane with default CLI agent type.
- Fill pane task with the Skill activation prompt and Mission required reading.
- Attach pane mission metadata.

Acceptance:

- Created pane name is `Squad Lead - <mission-name>`.
- Pane task includes required Mission files.
- Pane card shows mission badge after creation.

### Task 7: Add Team Tab To Hub Workspace View

Scope:

- `packages/web/src/stores/workspaceStore.ts`
- `packages/web/src/components/EditorTabs.tsx`
- new mission components

Work:

- Add pinned `Team` tab.
- Add `team` to editor tab type.
- Render `MissionPanel` for the Team tab.

Acceptance:

- Hub connected workspace view shows `Team` beside `Activity` and `Review`.
- Team tab cannot be closed.
- Non-Team tabs still behave as before.

### Task 8: Build Mission Store And Client API

Scope:

- `packages/web/src/stores/missionStore.ts`
- web API client helpers

Work:

- Load Mission list.
- Load active Mission.
- Load active Mission details.
- Expose refresh and activate actions.
- Keep Mission state separate from `workspaceStore.ts`.

Acceptance:

- Team tab can render loading, empty, active Mission, and incomplete Mission states.
- Refreshing Mission data does not reset editor tabs or pane state.

### Task 9: Build Mission Selector And Overview

Scope:

- `MissionSelector.tsx`
- `MissionOverview.tsx`

Work:

- Show active Mission at the top of Team panel.
- Allow creating Mission.
- Allow lifecycle activation with explicit confirmation that the current active Mission will become inactive.
- Show compact overview below selector.

Acceptance:

- Selector clearly distinguishes active, inactive, completed, and incomplete Missions.
- Overview shows Mission name, lifecycle, task counts, and unreviewed Done count.
- Activating a Mission refreshes Team data.

### Task 10: Build Read-Only Mission Kanban

Scope:

- `MissionKanban.tsx`
- Kanban parser tests

Work:

- Parse `To Claim`, `In Progress`, and `Done`.
- Render task cards from Skill task blocks.
- Add read-only filtering by status, Agent, and text.
- Add click-through to `kanban.md` source where practical.

Acceptance:

- Kanban is the largest Team panel region.
- Team UI does not write Claim, Complete, or Review changes.
- Parser failures show raw fallback without corrupting files.

### Task 11: Build Mission Agents Observation

Scope:

- `MissionAgents.tsx`
- mission agents parser

Work:

- Parse Mission-level `agents.md`.
- Show Agent name, responsibility, prompt summaries, and assigned task count.
- Do not add Agent operation buttons.

Acceptance:

- Agent area is secondary to Kanban.
- Agent cards have no Start Pane, Send Prompt, or Claim controls.
- Task counts match parsed Kanban `To` values.

### Task 12: Add Mission Agent Choice To Add Pane Dialog

Scope:

- `packages/web/src/components/AddPaneDialog.tsx`

Work:

- If an active Mission exists, show a Mission Agent selector in Add Pane.
- Selecting a Mission Agent fills pane name and task.
- Keep agent type defaulted from Mission default CLI setting unless user changes it.
- Attach pane mission metadata on create.

Acceptance:

- Add Pane can create a pane associated with active Mission Agent.
- Users can still create normal panes with no Mission.
- Team Agent cards are not used as launch buttons.

### Task 13: Show Mission Badges On Pane Cards

Scope:

- `packages/web/src/components/AgentPane.tsx`
- pane type definitions

Work:

- Display mission name, mission role, and mission agent name on pane cards.
- Keep the badge compact and readable.

Acceptance:

- Mission panes are visually distinguishable.
- Non-Mission panes are unchanged.

### Task 14: Add Pane Filters

Scope:

- pane list container in Hub workspace view
- workspace store or local UI state

Work:

- Add filter controls for Mission and agent type.
- Support all / no mission / mission name.
- Support all / configured agent type.

Acceptance:

- Filtering hides and shows panes without closing or restarting them.
- Filters do not modify workspace config.

### Task 15: Support Pane Title Editing

Scope:

- `packages/web/src/components/AgentPane.tsx`
- `packages/server/src/workspace/WorkspaceManager.ts`
- API or WebSocket handler

Work:

- Add inline pane title edit.
- Persist title to workspace config.
- Add server handler such as `PATCH /api/panes/:paneId/title` or equivalent WebSocket event.

Acceptance:

- User can rename a pane.
- Rename survives Mexus restart.
- Rename does not alter mission metadata, agent type, workdir, restore mode, or task.
