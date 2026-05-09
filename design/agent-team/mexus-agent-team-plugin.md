# Mexus Agent Team Plugin 设计

Status: draft
Date: 2026-05-10
Owner: Squad Lead (待 Mission 启动时分配)

## 背景

Mexus 当前版本通过 `.claude/skills/agent-team-mission-workflow/` 提供 Markdown-backed Mission 工作流。Phase 5（已落地，commit `181c7ec`）实现了 A2A inbox pipeline，让 Mission Agent 能在 kanban / roundtable 文件变化时收到 `[Mission Inbox]` 注入。

实际使用中暴露了两个关键问题：

1. **Squad Lead 派发任务时倾向使用 Claude Code 的 `Agent` 工具开 subAgent**，而不是创建真实 Pane。导致任务对 Mexus 不可观测，无法实现多个异构 CLI Agent 并行——这与 Mexus 的核心价值冲突。
2. **当前 skill 体系只解决了 Mission 创建，缺少派发、归档、Agent roster 维护等生命周期命令**。Squad Lead 没有"母语"工具，只能在通用工具集里挑一个最近的，自然就选了 subAgent。

本文档定义 `mexus-agent-team` plugin 的整体设计，作为这两个问题的根本解。

## 顶层原则：Agent 自治理

**Plugin 只是手段，不是目的。本质目标是让 Agent Team 自治理。**

Squad Lead 决定 Mission 怎么拆、任务派给谁、审什么；worker Agent 自己 claim、执行、提出 clarification；多 Agent 决策走 roundtable。Mexus 和 plugin 只提供底层基础设施——Pane、Markdown 文件、inbox 通知、派发命令——不替 Agent 做决策。

设计选择的判定原则：当一个行为既可以"加进 Mexus / plugin 代码"，又可以"通过 Squad Lead 的提示词 + 一个原始命令实现"时，**永远选后者**。前者把权威从 Agent 移到平台，是反目标的。

具体推论：
- Mission 文件内容由 Squad Lead 创作，不由命令生成。
- `/dispatch` 只做"开 Pane + 注入元数据"，不解析 kanban、不替 Squad Lead 决定派给谁。
- 任务质量、roster 设计、roundtable 决策——全部留给 Agent，命令不预设。
- Plugin 的所有命令都应该是"原语"，可以被 Squad Lead 自由组合，而不是封装好的"工作流"。

## 核心判断

### 边界一：Agent vs subAgent

- **Agent** = Mexus 切分工作的粒度，对应一个真实 Pane，被 kanban 命名、被 inbox 通知、被用户观测、被 agents.yaml 互感知。
- **subAgent** = 单个 Agent 内部执行任务的粒度，由 Pane 内的模型自主决定，Mexus 不关心也不应该关心。

层级混淆导致 Squad Lead 把"团队成员"角色降级成"调研助手"。修正这个边界靠两件事：(1) 给 Squad Lead 一个直白的派发命令 `/dispatch <agent>`，让"派 Pane"成为最近的路径；(2) 在 squad-lead 激活提示词里明确"Mission 任务的承接者必须是 Pane"。

### 边界二：Mission 文件的所有者

Mission 文件（mission.md / agents.md / kanban.md / roundtable.md / squad-lead.md）的内容应由 Squad Lead 负责创作。`/mission-create` 命令本身**不生成骨架**，只负责起一个 Squad Lead Pane 并把用户原始需求注入。

理由：
- Squad Lead 的角色定义就是 mission decomposition；命令抢了这个职责，Squad Lead 启动后要么照单全收（失去判断）要么推翻重拆（白做）。
- 真实场景中用户给的需求都很粗糙，需要 Squad Lead 对话澄清，无法在创建瞬间一次性拆完。
- 命令逻辑极薄，长期维护成本低。

### 边界三：Plugin vs Skill

Agent Team 是一组强耦合、版本化、整体演进的能力（slash command + skill + CLI + 模板 + 工作流规范），天然是 plugin 形态。Plugin 给两个关键属性：版本号（与 Mexus 版本对齐）和 marketplace 入口（一键安装）。

### 边界四：Template 角色

`references/` 下的 5 个 Mission 文件 template **保留**，但用途从"被命令复制填充"变为"被 Squad Lead 阅读参照"。同一份文件，读者从代码改成模型；这恰好对应 Claude Code 把 references/ 自动暴露给 skill 上下文的设计。

Schema 文档（mission-workflow.md）和 template 并存：前者讲规则，后者讲样式。规则太抽象，模型容易写偏；template 是具象样本，比纯规则有效得多。

## Plugin 形态

### 安装路径：按需

不打包进 `mexus init`。Mexus 主流程（多 Pane 终端管理）不依赖 plugin，绝大多数用户只想看终端，强制安装会污染 `.claude/`。

Plugin 的入口在 Mexus Web 的 Team tab——首次进入 Team 时显示"启用 Agent Team"引导，给出 `claude /plugin install mexus-agent-team` 指引。用户选择启用后才安装。

### 目录结构

```
mexus-agent-team/
├── plugin.json                         # name, version, mexus 兼容版本
├── README.md
├── skills/
│   ├── mission-create/SKILL.md         # /mission-create
│   ├── mission-activate/SKILL.md       # /mission-activate
│   ├── mission-archive/SKILL.md        # /mission-archive
│   ├── mission-agent-add/SKILL.md      # /mission-agent-add
│   ├── mission-agent-remove/SKILL.md   # /mission-agent-remove
│   ├── dispatch/SKILL.md               # /dispatch
│   └── dispatch-list/SKILL.md          # /dispatch-list
└── references/
    ├── mission-workflow.md             # 工作流规范（Status Flow、Inbox Protocol 等）
    ├── mission-template.md             # 5 个 Mission 文件参照样本
    ├── agents-template.md
    ├── kanban-template.md
    ├── roundtable-template.md
    └── squad-lead-template.md
```

CLI 实现放 Mexus 主仓（`mexus pane *`、`mexus mission *`），plugin 的 skill 只是外壳，shell out 到 `mexus` 命令。理由：(1) Mexus 自身 CLI 直接可用；(2) plugin 不重复 CLI 实现；(3) 未来若 plugin 独立运行，仍可依赖一个已安装的 mexus。

## Slash Command 清单

按优先级分三档。

### 核心四件套（MVP）

| 命令 | 语义 |
|---|---|
| `/mission-create <name> "<原始需求>"` | 起一个 Squad Lead Pane；mission.md 等文件由 Squad Lead 在对话过程中按 references/ template 创建；写完后由 Squad Lead 调 `mexus mission activate <name>` |
| `/mission-activate <name>` | 切换 active Mission，触发 `MissionInboxPipeline.restartForActiveMission` |
| `/mission-archive <name>` | 归档 Mission：移动目录到 `agent-team/missions/_archived/`、deactivate、关闭挂着的 Mission Pane |
| `/dispatch <agent-name>` | 检查目标 Agent 是否已有 Pane；没有就用 `mexus pane create` 创建并附上 mission 元数据；inbox pipeline 自动接力把 kanban 任务注入 |

### 次刚需三件套

| 命令 | 语义 |
|---|---|
| `/mission-agent-add <name> [--role ...]` | 引导 Squad Lead 把 Agent 加入 agents.md 的 roster + activation prompt 段，保持 Inbox Protocol 标注一致 |
| `/mission-agent-remove <name>` | 从 agents.md roster 移除（不动 Pane，Pane 由 `/dispatch-close` 或手工管理） |
| `/dispatch-list` | 列出当前 Mission 所有 Pane 状态（在线 / idle / stopped），Squad Lead 决策前必看 |

### 可推迟

`/mission-status`（仪表盘）、`/dispatch-close`（关单个 Pane）、`/roundtable-open|close`（roundtable 决策）。这些频率较低或可由手工 + 已有命令组合替代，不进 MVP。

## CLI 子命令

放 Mexus 主仓 `packages/server/src/cli.ts`，扩展现有的 `mexus start/init/status/stop`。

### Pane 管理

- `mexus pane create --name <X> --agent <claudecode|codex|...> --workdir <path> [--task <T>] [--mission <name>] [--mission-agent <name>] [--mission-role <squad-lead|mission-agent>]`
- `mexus pane list [--mission <name>] [--json]`
- `mexus pane close <id>`

### Mission 管理

- `mexus mission list [--json]`
- `mexus mission active`
- `mexus mission activate <name>`
- `mexus mission validate <name>`（schema 校验，给 Squad Lead 写完文件后用）

CLI 实现走当前已经在跑的 server 的 REST endpoint，不直接持有 `WorkspaceManager`——这样无论 server 是 dev 还是生产模式都能用，也避免双进程争 PTY。

### REST endpoints 补齐

Mexus 现在 Pane 生命周期只走 WS（`pane.create` 事件），CLI 没法用。需要补：

- `POST /api/panes` — 创建 Pane
- `GET /api/panes` — 列出 Pane
- `DELETE /api/panes/:id` — 关闭 Pane

Mission 相关 endpoint 已存在（Phase 3 `e7b2c84` Hub 路线已经引入）。

## Squad Lead 工作流

### 启动阶段（drafting）

`/mission-create my-feature "<原始需求>"` 执行后：

1. 命令调用 `mexus pane create` 起一个 Squad Lead Pane，name 为 `Squad Lead (my-feature)`，agent 为 claudecode，workdir 为当前 repo。
2. Pane 启动后，Claude Code 加载 plugin 的 squad-lead skill，激活提示词大致为：

   > 你是新 Mission `my-feature` 的 Squad Lead。用户原始需求：`<原始需求>`。
   >
   > 参考 plugin `references/` 下的 5 个 template（mission/agents/kanban/roundtable/squad-lead）。这些是 Mission 文件的标准样式，**结构和字段命名必须照这个走，内容根据用户需求填充**。
   >
   > 流程：(1) 和用户对话澄清 Goal / Acceptance / Roster；(2) 在 `agent-team/missions/my-feature/` 下基于 template 创建五个文件；(3) 全部写完后运行 `mexus mission validate my-feature` 检查 schema，再运行 `mexus mission activate my-feature` 切换为 active。
   >
   > 在 Mission 文件未完整写出之前不要派 `/dispatch`。

3. 用户切到这个 Pane 与 Squad Lead 对话，文件被 Squad Lead 创建出来。

### 派发阶段（active）

Mission 文件齐全且 active 后：

1. Squad Lead 在 kanban 上写 `To Claim` 任务。
2. Squad Lead 调 `/dispatch <agent-name>`：
   - 检查 `mexus pane list --mission <active>` 中是否已有该 Agent 的 Pane。
   - 没有就 `mexus pane create --mission <active> --mission-agent <name> --mission-role mission-agent ...`。
   - inbox pipeline 自动监听 kanban，把 W1 task-assigned 事件注入新 Pane 的终端。
3. Worker Agent 在自己的 Pane 里看到 `[Mission Inbox]` 注入，读 kanban，认领并执行任务。

squad-lead.md 激活提示词中的关键约束（plugin 安装时由 mission-create 命令注入）：

> 当 kanban 上有任务的 To 字段指向某个 Agent 时，你的派发动作是：调用 `/dispatch <agent-name>`。该命令会确保对应 Pane 存在并接收任务。**不要尝试用其他方式自行执行该 Agent 的任务——任务的承接者必须是 Pane。**

最后半句是边界声明，加上 `/dispatch` 的存在，subAgent 误用会自然消解。

### 归档阶段

`/mission-archive my-feature`：

1. CLI 调 `mexus mission archive my-feature`，server 端：
   - 把 `agent-team/missions/my-feature/` 移到 `agent-team/missions/_archived/my-feature/`。
   - 如果当前 active 是这个 Mission，先 deactivate，触发 `MissionInboxPipeline.restartForActiveMission`（idle 状态）。
   - 列出所有挂着 `mission.name === "my-feature"` 的 Pane，逐一调 `closePane`。如果有 Pane status 是 `running`，要求 `--force` 或报错。
2. 归档目录的 inbox 状态 `.nexus/mission-inbox.json` 不需要清理，dedupe 集合按 ref 隔离。

## 与 Phase 5 inbox pipeline 的衔接

Phase 5 已落地的能力在 plugin 路线下保持不变：

- `MissionKanbanWatcher` / `MissionRoundtableWatcher` 监听 active Mission 的 kanban / roundtable 文件，emit InboxEvent。
- `MissionInboxService` 持久化 dedupe + pending。
- `MissionPaneNotifier` 把 InboxEvent 注入对应 Pane（按 `mission.agentName` / `mission.role` 解析）。
- `MissionInboxPipeline` 在 `onMissionChanged` 时重启 watchers。

Plugin 的 `/dispatch` 命令在 `mexus pane create` 时附 `--mission`、`--mission-agent`、`--mission-role` 参数，server 端把这些写入 `pane.mission` 字段。这正是 `MissionPaneNotifier` 解析 Pane 用的字段，不需要任何 pipeline 改动。

## 实施路径

按依赖顺序分三阶段。

### Phase A — CLI + REST 基础（MVP 前置）

1. server 加 REST：`POST/GET/DELETE /api/panes`。
2. CLI 加子命令族：`mexus pane create/list/close`、`mexus mission list/active/activate/validate/archive`。
3. 用本地手测验证 CLI 能正确创建/关闭 Pane。

### Phase B — Plugin MVP

1. 在 Mexus monorepo 加 `packages/plugin-agent-team/`，初始化 plugin.json。
2. 把现有 `.claude/skills/agent-team-mission-workflow/references/` 下的 6 个文件挪到 plugin 的 references/。
3. 实现 4 个核心 slash command 的 SKILL.md。
4. 在 Team tab 加"启用 Agent Team"引导。
5. 用一个真实 Mission 走完 create → dispatch → archive 全流程。

### Phase C — 次刚需 + 完善

1. 实现 `/mission-agent-add`、`/mission-agent-remove`、`/dispatch-list`。
2. 优化 Squad Lead 激活提示词（基于 Phase B 的 dogfooding 反馈）。
3. plugin 发布到 marketplace。

每个 phase 结束做一次完整的 Mission 演练，验证 subAgent 误用问题是否真的消失。

## 待确认的边界问题

文档定稿前还需要决定：

1. **`/mission-create` 的初始需求载荷怎么传给 Squad Lead？** 命令行参数（短）vs 提示用户在新 Pane 里粘贴（长但灵活）。倾向参数 + 长需求时支持 `--from-file <path>`。
2. **Plugin references/ 路径如何被 Squad Lead 找到？** 走 plugin 标准安装路径，激活提示词里写完整路径。需要确认 Claude Code plugin 安装路径在 Mexus 进程中是稳定可访问的。
3. **`mexus mission validate` 校验范围？** 至少要校验 5 个文件存在 + parse 不抛 `ok: false`。是否额外校验 roster 一致性（agents.md 中列出的 Agent 是否都在 kanban 出现过）等"语义级"规则，可以在 Phase C 决定。
4. **drafting 阶段的 active 状态？** 倾向 `/mission-create` 不立即设为 active，由 Squad Lead 写完文件后自己 `mexus mission activate`。理由是 drafting 期间没有 worker pane，inbox 监听一个不完整的 Mission 没意义。

## 不在本设计范围

- Plugin 独立于 Mexus 运行（用户提及但明确推迟）。
- 多 Mission 并发激活（当前 `MissionInboxPipeline` 单 active Mission 设计已够用）。
- Mission 间的依赖 / 跨 Mission 引用。
- Plugin 国际化 / 多语言提示词。

## 参考

- `agent-team/missions/hub-agent-team-mission-mvp/` — 当前 dogfooding Mission，验证此设计的标的。
- `packages/server/src/mission/` — Phase 5 inbox pipeline 实现，本设计的衔接点。
- `design/agent-team/mexus-agent-team-mission-integration.md` — 上一版 Mission 集成设计，本文档是其延续。
