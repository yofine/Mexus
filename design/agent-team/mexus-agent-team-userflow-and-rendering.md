# Mexus Agent Team 使用链路梳理

状态：讨论稿
日期：2026-05-17

## 基本前提

Mexus 已经有 Team UI。本文档不是从零设计 Team tab，也不是讨论是否需要 Team UI，而是以现有 Team UI 为基础，梳理用户从安装 Mexus 到使用 Agent Team 开发的完整链路，并标出当前链路中的断点。

现有 Team UI 已包括：

- Workspace 中 pinned `Team` tab。
- `MissionPanel` 作为 Team tab 主面板。
- `MissionSelector` 支持 Mission 切换、`New Mission`、非 active Mission 的 `Activate`。
- `MissionCreateDialog` 支持通过 UI 创建 Mission，输入 name / goal / constraints / acceptance。
- `MissionOverview` 展示 Mission 概览和 task counts。
- `MissionKanban` 展示 `To Claim / In Progress / Done`。
- `MissionAgents` 展示 Mission agents 和职责。
- `SquadLeadLog` 展示 Squad Lead log。
- `EnableAgentTeamBanner` 作为无 Mission 时的引导提示。
- `missionStore` 已接入 `/api/missions`、`/api/missions/:name`、`/api/missions/:name/activate`、`POST /api/missions`。
- server 侧已有 `MissionService` 和 mission routes，支持 list / create / detail / active / activate / archive / repair。

因此，后续所有 userflow 都应以 “Team tab 是 Mexus 内置主入口” 为基础。

## 目标体验

普通用户不需要理解插件路径、模板文件、脚本命令或 board app 路径。用户应该只感知到：

```text
打开 Mexus -> 进入 Team -> 创建 Mission -> 激活 Mission -> 创建 Agent panes -> 观察 kanban -> review -> archive
```

`/team`、`/team-status`、`/board` 是快捷或辅助入口，不是 Mexus 主流程。

## 关键判断：Agent Team 启动必须平台化

通过 Squad Lead 来“启动 Agent Team”对用户来说不够稳定，也不够明确。

Squad Lead 是 agent 角色，适合做 Mission 创建后的澄清、拆解、派发和 review，但不适合承担系统初始化责任。Agent Team 启动涉及 Mission 文件创建、生命周期状态、pane metadata、默认 CLI agent、Team UI 状态、active Mission 约束等平台级行为，这些必须由 Mexus 稳定完成。

职责边界应调整为：

```text
用户启动 Agent Team
-> Mexus 创建 Draft Mission 基础结构
-> Mexus 创建或打开 Squad Lead pane
-> Mexus 注入稳定 Squad Lead 启动 prompt
-> Squad Lead 接管 Mission drafting
```

因此：

- **Mexus 负责启动 Team。**
- **Squad Lead 负责规划 Mission。**
- **Mission Agents 负责执行任务。**
- **Team UI 负责观察和生命周期操作。**

这也决定了 `/team` 在 Mexus 环境中的定位：它不应该让当前 agent 自己即兴初始化整套 Agent Team，而应尽量等价于 Team UI 的 `New Mission`，走同一个 server-side Mission 创建路径。只有在 standalone plugin 环境中，才 fallback 到纯插件脚本创建 Markdown 文件，并让当前 CLI agent 扮演 lead。

## 关键判断：执行方式是创建 Mission 时的平台确认动作

Agent Team 的执行方式不应该等到 Squad Lead 自己决定，也不应该隐含在后续 pane 创建里。它应该是平台创建 Mission 时的确认动作之一。

创建 Mission 时，用户需要确认：

```text
Execution mode
- Agent Panes
- Single Agent with subAgents

Agent runtime defaults
- Squad Lead: <agent type>
- Mission Agents: <agent type>
- Per-agent override: optional
```

### Execution mode: Agent Panes

含义：

- 每个 Mission Agent 可以对应一个真实 pane。
- pane 携带 Mission marker、agentName、role、agent type。
- 用户可以分别观察每个 agent 的终端、状态、文件活动和任务进度。

适合：

- Mexus 主流程。
- 需要强可观测性。
- 多 agent 长时间并行。
- 需要混合 Claude Code / Codex / shell 等不同 agent 类型。

平台责任：

- 在 Mission 创建确认时记录 execution mode。
- 允许为每个 Agent 配置默认 agent type。
- Create Pane 根据 Mission agent 自动填充 agent type、title、prompt、mission metadata。

### Execution mode: Single Agent with subAgents

含义：

- Mexus 只需要一个主 agent pane 承接 Mission。
- 主 agent 按 kanban 拆分任务，并调用自身 runtime 的 subAgent 能力执行。
- subAgents 的结果必须回写 `kanban.md`。

适合：

- 用户希望工作区更简洁。
- 任务规模中等，不需要观察多个终端。
- standalone plugin 或没有 Mexus pane runtime 的场景。

平台责任：

- 在 Mission 创建确认时记录 execution mode。
- 创建或引导打开一个主 agent pane。
- 给主 agent 注入明确 prompt：按 kanban 调度 subAgents，结果回写 kanban。
- Team UI 中不要引导用户为每个 Mission Agent 都创建 pane。

### 共同规则

无论用户选择哪种 execution mode：

- `agent-team/` Markdown 仍是 source of truth。
- `kanban.md` 仍记录 task lifecycle。
- Squad Lead 仍负责 planning、routing、review。
- Agent prompt 仍遵守 kanban-first。
- Team UI 仍展示 Mission / kanban / agents 的最终状态。

execution mode 只决定“任务由几个运行实体承接”，不改变 Mission 协议。

## 现有链路

### 1. 安装并启动 Mexus

用户预期：

```text
我安装 Mexus，是为了获得一个多 agent 开发工作台。
```

现有基础：

- Mexus 启动 workspace。
- Mexus 创建 agent panes。
- `packages/mexus-plugin` 会被 Mexus 启动的 agent CLI 加载。
- 插件当前已有 session bind hook。
- Team tab 已作为 workspace 固定 tab 存在。

当前断点：

- 安装后没有明确告诉用户：Agent Team 是 Mexus 已内置的工作流入口。
- 用户可能误以为还需要先安装外部 `mexus-agent-team` plugin。
- Team tab 虽然存在，但产品叙事上还没有成为“开始团队协作”的默认下一步。

### 2. 进入 Workspace 后看到 Team tab

用户预期：

```text
我在项目 workspace 里看到 Team，它应该告诉我现在有没有团队任务，以及下一步做什么。
```

现有基础：

- Team tab 已展示在 editor tabs 中。
- `MissionPanel` 会加载 missions。
- 无 Mission 时显示 onboarding。
- 有 Mission 时展示 selector / overview / kanban / agents / Squad Lead log。

当前断点：

- onboarding 仍带有启用插件提示，容易让用户以为 Team 不是 Mexus 内置能力。
- 空状态的主动作应该是 `New Mission`，而不是引导用户理解插件安装。
- 如果已有 Mission，Team UI 能展示状态，但“下一步动作”还不够明确，例如 Draft 后要做什么、Active 后要创建哪个 pane。

建议口径：

- Team tab 是 Mexus Agent Team 的主入口。
- 插件安装提示只适用于 standalone / 外部环境，不应作为 Mexus 内置流程的主提示。
- 空状态主 CTA：`New Mission`。

### 3. 通过 Team UI 创建 Mission

用户预期：

```text
我点击 New Mission，输入目标，Mexus 创建一个可继续推进的 Mission。
```

现有基础：

- `MissionCreateDialog` 已存在。
- 表单字段：name / goal / constraints / acceptance。
- `missionStore.createMission` 调用 `POST /api/missions`。
- `MissionService.createMission` 创建 `agent-team/` 文件。

现有生成物：

```text
agent-team/
├── mission-workflow.md
├── agents.md
└── missions/<mission-name>/
    ├── mission.md
    ├── agents.md
    ├── kanban.md
    ├── roundtable.md
    └── squad-lead.md
```

当前断点：

- Mission 创建后的状态语义需要明确：创建后是 Draft / inactive，不应直接等于开始并行执行。
- 创建后是否自动创建 Squad Lead pane，目前需要统一产品决策。
- 创建时还缺少 execution mode 确认：用多个 Agent Panes，还是用单 Agent 的 subAgents 执行。
- 创建时还缺少 agent type 配置：Squad Lead 用什么 CLI，Mission Agents 默认用什么 CLI，以及是否允许单个 Agent override。
- UI 创建 Mission 和 `/team` 创建 Mission 目前可能走不同实现路径，生成内容、默认 lifecycle、首个 task 语义需要统一。

建议口径：

- Team UI New Mission 是主路径。
- 创建 Mission 由 Mexus 平台完成，不能依赖 Squad Lead 自己初始化。
- 创建 Mission 应包含平台级确认：目标、约束、acceptance、execution mode、agent type defaults。
- 创建 Mission 完成 Mission draft 的初始化和 Squad Lead 启动准备。
- 创建后下一步应该是进入 Squad Lead drafting，而不是直接创建 worker panes。

### 4. Squad Lead Drafting

用户预期：

```text
Mission 创建后，先由 Squad Lead 澄清目标、拆任务、定义 agents，然后再激活。
```

现有基础：

- Mission 文件中已有 `squad-lead.md`。
- `agents.md` 可记录 agent 职责和 prompt。
- `kanban.md` 可记录首批任务。
- Team UI 已能观察 kanban / agents / Squad Lead log。

当前断点：

- Team UI 已能展示 Mission，但 Draft 阶段的“该做什么”还不够清楚。
- Squad Lead pane 的创建时机不明确：
  - New Mission 后自动创建？
  - 用户点击 `Open Squad Lead`？
  - 只生成文件，等用户自己 create pane？
- Draft 完成条件不明确。

关键判断：

- Squad Lead 不应负责“启动 Agent Team”。
- Squad Lead pane 是 Mission 启动后的第一个执行角色。
- Squad Lead 接到的第一个任务应是 drafting：澄清目标、定义 roster、发布首批 tasks。
- Mission 文件初始化、lifecycle 初始状态、pane metadata 注入应由 Mexus 完成。

建议 Draft 完成条件：

- `mission.md` 有清晰 goal / constraints / acceptance。
- `agents.md` 至少有 Squad Lead 和一个可执行职责的 worker agent，或明确只有 Squad Lead 继续拆解。
- `kanban.md` 至少有一条可 claim 的 task。
- Squad Lead prompt 明确：
  - 当前只是第一个任务；
  - 后续任务继续通过 kanban 指派；
  - 任务不符合职责时可改派；
  - 无法确定 owner 时发布 Squad Lead clarification task。

### 5. 激活 Mission

用户预期：

```text
我确认这个 Mission 已准备好开始执行，然后显式激活它。
```

现有基础：

- `MissionSelector` 已显示 lifecycle label。
- selected Mission 非 active 时已有 `Activate` 按钮。
- 激活时会提示 current active Mission 会变 inactive。
- server 侧已有 `/api/missions/:name/activate`。

当前断点：

- selected 和 active 的差异需要在 UI 文案与流程中保持明确。
- 一个 workspace 只能有一个 active Mission，这个规则已经有方向，但需要作为产品规则写清楚。
- 激活前校验还可以更明确，避免 incomplete / 空 kanban Mission 被激活。

建议规则：

- 选择 Mission 只是查看，不触发生命周期变化。
- Activate 是显式生命周期动作。
- 创建新 Mission 不自动抢占当前 active Mission。
- 如果已有 active Mission，激活另一个 Mission 时：
  - 当前 active Mission 变 inactive，或
  - 要求用户先 archive / complete 当前 Mission。

这里倾向使用简单规则：激活新 Mission 时旧 active 变 inactive，不引入冲突态。

### 6. 创建 Mission Agent Pane

用户预期：

```text
Mission active 后，我创建 pane 时可以直接选择这个 Mission 中的 agent。
```

现有基础：

- pane state 支持 Mission metadata。
- Add Pane 相关测试已覆盖从 active Mission agent 构建 pane name / task / mission metadata。
- pane 卡片可以携带 Mission 标记。
- pane 支持改标题。
- 设计上已倾向 Create Pane 时选择 active Mission agent，而不是从 kanban card 上派发。

当前断点：

- Team UI 与 Create Pane 之间的入口关系要更明确：
  - Team tab 中是否有 `Create Pane for Agent`？
  - 还是用户统一从全局 Create Pane 进入？
- Kanban card 不应放派发操作，这点需要继续保持。
- 用户需要知道哪些 agent 已有 pane，哪些还没有。

建议规则：

- 在 `Agent Panes` 执行模式下，Create Pane 是 Mission agent 派发的唯一主要操作面。
- 当存在 active Mission：
  - Create Pane 默认显示 Mission 区域；
  - 可选择 active Mission agent；
  - 选择后自动填 pane title、task prompt、mission metadata、agent type；
  - 用户可改标题；
  - 默认 CLI agent 来自 Mission 创建时的 agent type 配置，若未配置则使用系统默认 CLI。
- Team tab 可以显示 agent pane status，但不直接把 kanban card 变成操作面板。

在 `Single Agent with subAgents` 执行模式下：

- 不要求为每个 Mission Agent 创建 pane。
- Create Pane 主要用于创建或打开主 agent pane。
- 主 agent prompt 应明确：使用 subAgents 执行 kanban tasks，并把结果写回 `kanban.md`。
- Team UI 应显示该 Mission 当前由单主 agent 承接，而不是提示缺少每个 agent 的 pane。

### 7. Agent 执行任务

用户预期：

```text
Agent pane 启动后，自己按 kanban claim task、执行、更新结果。
```

现有基础：

- Agent prompt 模板已经要求读 mission files。
- `kanban.md` 是 task lifecycle source。
- Mission Inbox / watcher 等机制已存在于 Mexus 侧，用于后续通知。

当前断点：

- prompt 必须持续保持几个关键约束，否则 agent 容易绕过 kanban：
  - 当前只是第一个任务，不是全部任务；
  - 后续仍可能有职责范围内的新任务；
  - 优先执行 `To: <AgentName>`；
  - 不符合职责时可改派；
  - 无法确定 owner 时给 Squad Lead 发 clarification task。
- 如果 UI 创建、`/team` 创建、server template、plugin reference 之间模板不一致，会导致 agent 行为不一致。

建议规则：

- 所有 Mission 创建路径使用同一套 prompt 规则。
- 所有 Agent panes 必须带 Mission marker。
- Agent 完成任务时必须填：
  - Result；
  - Files；
  - Verification；
  - Updated；
  - 然后移动到 Done。

### 8. 观察 Mission

用户预期：

```text
我主要在 Team tab 看 Mission 当前进度，不需要打开文件才能理解状态。
```

现有基础：

- Team tab 已有 overview / kanban / agents / Squad Lead log。
- `MissionKanban` 已是观察区域。
- `MissionAgents` 已展示 agent 职责和 task counts。

当前断点：

- Team tab 已是主观察面，但需要在产品链路中明确它就是主观察面。
- `/board` 与 Team tab 的关系要明确：
  - 在 Mexus 内，Team tab 是主观察面；
  - `/board` 是独立 Web board，适合 standalone 或 detached viewing；
  - `/board` 不应是 Mexus 主流程必需步骤。
- `/team-status` 应只是终端摘要，不应替代 Team tab。

建议规则：

- Team tab 展示完整 Mission 状态。
- `/team-status` 只输出 Mission 摘要和 next action。
- `/board` 用于 Mexus Web 不可用或需要独立浏览器窗口时。

### 9. Review 与 Mission 收尾

用户预期：

```text
任务完成后有人 review，Mission 完成后可以归档。
```

现有基础：

- kanban task 有 `Review` 字段。
- overview / counts 可计算 unreviewed done。
- server 已有 archive route。

当前断点：

- Mission Done 与 Archive 的产品语义需要明确。
- Done task 是否必须 review 才能 Mission Done，需要定。
- Archive 是否关闭相关 panes，需要定。

建议一期规则：

- `Done` task 未 review 时，在 overview 中作为 attention。
- Mission 可以进入 completed，但 archive 前提示未 review 数量。
- Archive 不删除文件。
- Archive 后 Mission 只读查看。
- Archive 是否关闭 panes 由用户选择；默认不强制关闭。

## 三条入口的关系

### Team UI New Mission

定位：Mexus 主入口。

职责：

- 创建 Mission draft。
- 展示创建结果。
- 引导 Squad Lead drafting。
- 提供 activate。

### `/team`

定位：快捷入口。

职责：

- 在 Mexus-launched pane 中快速创建或继续 Mission。
- 如果 Mexus server 可用，优先调用和 Team UI 相同的 server-side create path。
- 如果没有 Mexus server，才 fallback 到 plugin script 写 `agent-team/` 文件。

非职责：

- 不替代 Team tab。
- 不直接启动完整多 agent 执行。
- 不启动 `/board`。

### `/board`

定位：独立观察入口。

职责：

- 启动 plugin 携带的 Web board。
- 读取当前项目 `agent-team/`。
- 服务 standalone / detached viewing。

非职责：

- 不作为 Mexus 主流程必需步骤。
- 不负责 Mission lifecycle。
- 不负责 pane dispatch。

## 推荐主流程

面向普通 Mexus 用户：

```text
1. 安装并启动 Mexus
2. 打开项目 workspace
3. 进入已有 Team tab
4. 点击 New Mission，输入目标
5. Mexus 创建 Draft Mission
6. Mexus 自动创建或引导创建 Squad Lead pane
7. Squad Lead 澄清目标、定义 agents、发布首批 tasks
8. 用户确认 execution mode 和 agent type 配置
9. 用户点击 Activate
10. 如果选择 Agent Panes，用户从 Create Pane 选择 active Mission agent
11. 如果选择 Single Agent with subAgents，主 agent pane 使用 subAgents 执行 kanban tasks
12. 用户在 Team tab 观察 overview / kanban / agents / log
13. Done tasks 完成 Review
14. 用户 Archive Mission
```

面向快捷命令用户：

```text
1. 在 Mexus-launched pane 中输入 /team "<request>"
2. /team 调用 server-side Mission create，或 fallback 到 plugin script
3. 用户回到 Team tab 查看 Draft Mission
4. Squad Lead drafting
5. 用户 Activate
6. 后续回到普通 Mexus 主流程
```

面向 standalone 用户：

```text
1. 使用 standalone plugin
2. 输入 /team "<request>"
3. host CLI subagents 按 kanban 执行
4. 输入 /board 打开独立 Web board
```

## 职责边界

### 已有 Team UI 负责

- 主 onboarding。
- Mission selector。
- Mission 创建。
- Mission activate。
- Mission overview。
- Kanban 观察。
- Agents 观察。
- Squad Lead log。

### Team UI 需要补齐或强化

- 创建 Mission 后的 next step。
- Squad Lead pane 创建 / 打开。
- Mission 创建时确认 execution mode：Agent Panes 或 Single Agent with subAgents。
- Mission 创建时配置 agent type defaults 和 per-agent override。
- active Mission agent 到 Create Pane 的自然入口。
- Mission completed / archive 的清晰流程。
- selected 与 active 的文案区分。

### `packages/mexus-plugin` 负责

- Mexus-launched agent CLI hooks。
- `/team` 快捷入口。
- `/team-status` 快捷摘要。
- `/board` 独立 Web board。
- references 和 scripts。

### `agent-team/` Markdown 负责

- Mission source of truth。
- agent 职责和 prompt。
- kanban task lifecycle。
- roundtable 决策记录。

### Agent panes 负责

- 执行具体 agent 工作。
- 按 kanban claim / update / done。
- 不跨职责边界擅自执行。
- 必要时发布 follow-up 或 clarification task。

## 当前最大断点

1. **已有 Team UI 与 `/team` 语义未统一**
   UI 走 server MissionService，`/team` 走 plugin script。两者需要生成相同结构、相同 lifecycle、相同首个 task 语义。

2. **Mission 创建后的下一步不够明确**
   New Mission 后用户应该进入 Squad Lead drafting，但是否自动创建 Lead pane、如何引导，还需要定。

3. **Draft / Active 生命周期还需要产品化**
   当前已有 activate，但 Draft 完成条件、active 前校验、selected vs active 的用户心智需要更清楚。

4. **Mission agent 到 pane 的闭环需要强化**
   Create Pane 已具备部分 Mission-aware 能力，但 Team tab 如何引导用户创建对应 agent pane 还需要确定。

5. **执行模式没有平台化确认**
   当前链路默认假设多 Agent Pane，但用户也可能想用一个主 Agent 的 subAgents 执行。这个选择应该在创建 Mission 时由平台确认。

6. **Agent type 配置没有进入 Mission 创建流程**
   用户需要能配置 Squad Lead 和各 Mission Agents 使用什么 agent type，而不是全部依赖全局默认。

7. **`/board` 与 Team tab 的关系需要固定**
   Team tab 是 Mexus 主观察面。`/board` 是独立/辅助场景。

## 优化建议

### 建议 1：保留 Team tab 作为主入口

不要重新设计入口。基于现有 Team tab：

- 空状态主 CTA 是 `New Mission`。
- 有 Mission 时直接展示 selector / overview / kanban / agents。
- 插件安装提示降级为 standalone 或外部环境说明，不作为主流程。

### 建议 2：统一 Mission 创建路径

理想方向：

- Team UI New Mission 和 `/team` 都走 server-side Mission create。
- `packages/mexus-plugin/scripts/start-mission.mjs` 只作为 standalone fallback。
- server `MissionService.createMission` 使用最新 Agent Team templates / prompt rules。

### 建议 3：创建后进入 Squad Lead Drafting

New Mission 后应出现明确下一步：

```text
Open Squad Lead
```

或自动创建 Squad Lead pane。

这里需要产品决策。推荐倾向：自动创建 Squad Lead pane，因为 Mission 创建后的第一件事就是 Squad Lead drafting。

### 建议 4：激活前校验

Activate 前至少校验：

- required files complete；
- `agents.md` 有可用 agent 定义；
- `kanban.md` 有 task；
- 没有解析错误。
- 已确认 execution mode。
- 已确认 Squad Lead 和 Mission Agents 的 agent type 配置，或有明确默认值。

校验失败时保持 Draft。

### 建议 5：Mission 创建时加入 execution mode 和 agent type 配置

`MissionCreateDialog` 不应只收集 name / goal / constraints / acceptance，还应该收集平台执行相关配置：

```text
Execution mode:
- Agent Panes
- Single Agent with subAgents

Agent type:
- Squad Lead default
- Mission Agent default
- Per-agent override
```

这个配置影响：

- 是否引导用户创建多个 agent panes。
- Squad Lead / main agent 的启动 prompt。
- Create Pane 的默认 agent type。
- Team UI 中 agent pane status 的解释方式。
- `/team` 在 Mexus 和 standalone 环境下的默认行为。

### 建议 6：Create Pane 接住 active Mission agent

当存在 active Mission：

- Create Pane 展示 Mission agent selector。
- 选中 agent 后自动填 prompt 和 mission metadata。
- 允许改 title。
- 默认 CLI agent 来自 Mission 创建时的 agent type 配置，缺省再回退到系统设置。

仅当 execution mode 是 `Agent Panes` 时，把“为每个 agent 创建 pane”作为主引导。

### 建议 7：Review / Archive 进入闭环

Team UI 需要提供 Mission 收尾路径：

```text
Done tasks -> Review attention -> Mark completed -> Archive
```

Archive 前提示：

- 未 review task 数量；
- 相关 panes 是否关闭。

## 待讨论问题

1. Team UI New Mission 后，是否自动创建 Squad Lead pane？
2. `/team` 在 Mexus-launched pane 中是否必须调用 server-side Mission create？
3. Draft Mission 的最低完成条件是什么？
4. Active Mission 状态应以 `mission.md` lifecycle 为准，还是 workspace/server state 为准？
5. Execution mode 应该在 Mission 创建时必选，还是允许创建后、激活前再选？
6. `Agent Panes` 是否应作为 Mexus 默认执行模式？
7. `Single Agent with subAgents` 模式下，Team UI 如何展示 agent status？
8. Agent type 是只配置 Squad Lead / Mission Agent 默认值，还是允许每个 agent override？
9. Team tab 是否需要一个 “Create pane for agent” 入口，还是完全走全局 Create Pane？
10. Mission completed 是否要求所有 Done tasks 都完成 Review？
11. Archive 默认是否关闭 Mission panes？
12. `EnableAgentTeamBanner` 在内置 Team UI 已存在后是否还应该显示插件安装命令？
