# Agent Team Mission Workflow 方案

## 1. 背景

Mexus 需要支持多种 CLI Agent 在同一个代码仓库中协作完成复杂工程目标。单个 Agent 在长任务中容易出现上下文丢失、职责漂移、重复修改、跨模块冲突和验收不清的问题；多个 Agent 并行时，这些问题会进一步放大。

因此需要一个轻量、可读、可恢复的 Agent Team 协作机制。这个机制不替代 CrewAI、AutoGen、LangGraph 等运行时框架，而是为 Mexus 中的多个 CLI Agent 提供仓库内的任务治理、角色恢复、任务流转、方案评审和发布者验收。

这个方案的核心单位是 **Mission**。

Mission 表示一组围绕同一目标的工程协作活动。它不是单纯的时间盒迭代，而是一个可被拆解、分配、追踪、评审和沉淀的目标单元。

## 2. 设计目标

Agent Team Mission Workflow 的目标是：

- 让多个 CLI Agent 能围绕同一工程目标协作。
- 让 Agent 在会话丢失后能快速恢复身份和职责。
- 让任务可以被领取、执行、完成和发布者验收。
- 让跨 Agent 决策有圆桌表决机制，而不是隐式写进代码。
- 让 Squad Lead 维护任务拆解、顺序、边界和风险。
- 让所有协作信息以 Markdown 文件留存在仓库内，便于人和 Agent 同时阅读。

非目标：

- 不做运行时 Agent 编排框架。
- 不做自动调度系统。
- 不引入额外格式校验机制。
- 不要求 Agent 通过 API 自动移动任务。
- 不强行把所有讨论都结构化。
- 不让 Roundtable 直接阻塞 Kanban 主线。

## 3. 核心概念

### Mission

Mission 是一个目标单元，放在：

```text
agent-team/missions/<mission-name>/
```

Mission 内部包含：

```text
mission.md
agents.md
kanban.md
roundtable.md
squad-lead.md
```

Mission 之外还有一个仓库级成员库：

```text
agent-team/agents.md
```

它记录已有 Agent 的长期能力、负责过的模块和工作经历，用于下一个 Mission 复用人力。它不是某次 Mission 的分工文件。

### Agent Roster

Agent Roster 是全局团队成员库，放在 `agent-team/agents.md`。

它记录：

- Agent 稳定名字。
- 主要负责过的模块。
- 可复用能力。
- Mission 工作经历。
- 后续复用建议。

它解决的问题是：Agent Team 不应该每次 Mission 都重新发明一批 Agent。已有 Agent 在某些模块上积累过上下文和历史，下一个 Mission 应优先复用这些成员，再根据缺口新增 Agent。

### Squad Lead

Squad Lead 是 Mission 的协调者，负责：

- 保持 Mission 目标不漂移。
- 拆解 workstream。
- 创建和维护 Agent 名单。
- 发布初始任务。
- 维护任务顺序和边界。
- 在需要时发起 Roundtable Review。
- Review 自己发布的任务。
- 记录与工程任务分配相关的工作日志。

Squad Lead 默认不写实现代码，除非用户明确要求。Squad Lead 也不是所有任务的总验收人，任务由 `From` 字段对应的发布者验收。

### Mission Agent

Mission Agent 是具体任务执行者。Agent 名字来自所罗门七十二柱，作为稳定沟通代号，不表达职责。

例如：

- `Bael`
- `Agares`
- `Vassago`
- `Samigina`
- `Marbas`
- `Valefor`
- `Amon`
- `Barbatos`

长期能力和经历写在仓库级 `agent-team/agents.md` 中；某次 Mission 的具体职责、Activation Prompt 和初始提示词写在该 Mission 的 `agents.md` 中。

### Kanban

Kanban 是任务主线，只有三个状态：

```text
To Claim
In Progress
Done
```

任务格式：

```md
To: Agent-X | From: Agent-Y | Scope: path/or/module
- Ref: Short git-commit-like task identifier. Written by the publishing agent.
- Request: Concrete dependency, implementation request, or question. Written by the publishing agent.
- Reason: Why this task is needed and what it unlocks. Written by the publishing agent.
- Acceptance: Observable completion criteria. Written by the publishing agent.
- Result: What was implemented or decided. Written by the To agent.
- Files: Files added or changed. Written by the To agent.
- Verification: Self-test results and commands run. Written by the To agent.
- Review: Cross-review result. Written by the From agent.
- Updated: Last update timestamp and agent label. Written by whichever agent updates the task.
```

其中 `Ref` 是短 git commit ID 风格的稳定 ID，用于追溯，不表达任务含义，也不使用 Agent 命名体系，避免和 Agent 代号混淆。例如：

```text
a3f9c2d
7b1e4a9
c0d8f31
```

### Roundtable

Roundtable 是方案评审和表决区，取自亚瑟王圆桌概念。

它用于记录 Agent 对关键方案的讨论和结论，但不直接改变 Kanban 状态，也不默认阻塞 Kanban 任务。Agent 执行任务或制定方案时，可以参考 Roundtable 中形成的结论。

适用场景：

- 共享协议或接口变化。
- 产品方向不清。
- 多 Agent 任务冲突。
- 任务范围扩张。
- 接受标准需要调整。
- 重大风险需要显式取舍。

状态：

```text
Pending Review
Approved
Rejected
```

投票规则：

- 邀请对象可以是相关 Agent、`All` 或 `Squad Lead`。
- 非弃权票中，`approve` 超过半数即通过。
- `abstain` 只记录参与，不计入通过阈值。
- `reject` 大于等于 `approve` 时，保留在 `Pending Review` 继续收窄，或移动到 `Rejected`。

评审项格式：

```md
Ref: Short git-commit-like review identifier.
Topic: Short decision topic
Opened by: AgentName
Invitees: AgentName, AgentName | All | Squad Lead
Scope: path/module/protocol/product area
- Question: What decision needs to be made?
- Context: Relevant background, constraints, and current state.
- Options: Concrete options under consideration.
- Recommendation: The opener's recommended option and why.
- Votes: Agent votes and short reasons.
- Decision: Final decision and owner.
- Follow-up: Related kanban task or reason no task is needed.
- Updated: Last update timestamp and agent label.
```

## 4. 文件职责

### `mission.md`

Mission 说明文件，记录产品或工程意图、战略约束、用户可见定位、实现顺序和最低验收标准。

### `agent-team/agents.md`

仓库级团队成员库，记录已有 Agent 的主要模块、可复用能力、工作经历和复用建议。

这个文件服务于跨 Mission 的人力复用。创建新 Mission 时，Squad Lead 应先查看该文件，判断哪些 Agent 可以继续承担相近模块，而不是直接创建新名字。

### `agents.md`

Mission 级 Agent 名册，记录本次 Mission 中的 Agent 名字、职责、Activation Prompt、初始任务提示词和推荐执行顺序。

Activation Prompt 是稳定的身份恢复提示词，用于 Agent 会话丢失后的“意识降临”。它应该帮助 Agent 迅速知道自己是谁、当前 Mission 是什么、需要读哪些文件、职责边界是什么、如何领取任务、完成后如何流转和 Review。Agent 职责不应在任务执行过程中随意漂移，因此 Activation Prompt 在创建时要写准确，后续只在角色设计确实变化时调整。

### `kanban.md`

任务主线，只记录任务状态和任务字段。格式由 `mission-workflow.md` 和文件头部模板约束，不引入额外校验机制。

### `roundtable.md`

方案讨论和表决区，记录重要决策过程。它与 Kanban 保持松耦合，不作为任务链的硬依赖。

### `squad-lead.md`

Squad Lead 自我定位和工作日志，记录 Squad Lead 职责、Activation Prompt、Mission 任务拆解和分配日志，以及 Squad Lead 自己发布任务的 Review 日志。

### `mission-workflow.md`

仓库级机制说明，记录 Mission 文件结构、角色定义、Agent 命名规则、Mission 工作流、Kanban 任务格式、Roundtable 机制、发布者验收机制和共享文件冲突处理。

## 5. 工作流

### 1. 创建 Mission

Squad Lead 创建：

```text
agent-team/missions/<mission-name>/mission.md
agent-team/missions/<mission-name>/agents.md
agent-team/missions/<mission-name>/kanban.md
agent-team/missions/<mission-name>/roundtable.md
agent-team/missions/<mission-name>/squad-lead.md
```

### 2. 写 Mission Brief

Squad Lead 把用户原始诉求、战略约束、实现顺序和最低验收标准写入 `mission.md`。

### 3. 定义 Squad

Squad Lead 先查看 `agent-team/agents.md`，优先复用已有 Agent；如果没有合适成员，再创建新的稳定 Agent 名字并写入全局成员库。

然后 Squad Lead 在本次 Mission 的 `agents.md` 中创建 Agent 名字、职责、Activation Prompt 和初始提示词。

### 4. 发布初始任务

Squad Lead 在 `kanban.md` 的 `To Claim` 下发布任务。

### 5. Agent 领取任务

Agent：

- 阅读 `mission-workflow.md / mission.md / agents.md / kanban.md / roundtable.md`。
- 找到 `To: <自身名字>` 的任务。
- 将任务移动到 `In Progress`。
- 更新 `Updated`。

### 6. Agent 执行任务

Agent 在 `Scope` 范围内工作。

如果发现需要其他 Agent 支持，则发布新任务。

如果发现需要多人决策，则创建 Roundtable Review。

### 7. Agent 完成任务

Agent：

- 运行验证命令。
- 将任务移动到 `Done`。
- 填写 `Result / Files / Verification / Updated`。

### 8. 继续领取或 Review

Agent 完成任务后：

- 先看 `To Claim` 是否还有自己的任务。
- 有则继续领取。
- 没有则检查 `Done` 中是否有自己发布且未 Review 的任务。

### 9. 发布者验收

任务发布者负责 Review 自己发布的任务。也就是说，只有当任务的 `From` 是当前 Agent 时，当前 Agent 才需要验收这个任务。

Review 通过：

```md
Review: accepted by <agent>, <date> - <reason>
```

Review 不通过：

- 发布修复任务。
- 在原任务的 `Review` 或相关工作日志中记录原因。

### 10. 更新成员经历

当一个 Mission 给 Agent 分配了有代表性的模块或工作流后，Squad Lead 应更新 `agent-team/agents.md`：

- 新增或修正 `Primary modules`。
- 补充 `Known strengths`。
- 在 `Work history` 中记录 Mission、日期、工作流和状态。
- 在 `Notes` 中写明后续复用建议。

## 6. 与主流 Agent Team 方案对比

| 维度 | Agent Team Mission Workflow | CrewAI | OpenAI Agents SDK | Microsoft Agent Framework | LangGraph / LangChain Multi-Agent | AutoGen / AgentChat |
| --- | --- | --- | --- | --- | --- | --- |
| 核心定位 | 仓库内多 CLI Agent 协作机制 | 多 Agent 应用运行时 | Agent handoff 与工具化运行时 | 企业级 Agent 与 workflow 框架 | 有状态图执行框架 | 多 Agent 对话与群聊框架 |
| 主要状态载体 | Markdown 文件：mission、agents、kanban、roundtable | 运行时对象、crew、flow、task | run、handoff、tool、conversation | session、workflow、agent、provider | graph state、node、edge | conversation state、message history |
| 适用场景 | Mexus 中多 CLI Agent 协作写代码、分工、恢复、验收 | 构建可运行的多 Agent 应用 | 应用内 Agent 交接和工具调用 | 生产级业务流程和 Agent 应用 | 需要显式状态机和可恢复执行的 Agent 系统 | 多角色对话、协商、人类反馈 |
| 任务分配方式 | Kanban 中 `To / From / Scope` 显式发布 | task/process 分配 | handoff 给专业 Agent | workflow 或 agent API 编排 | graph 路由、supervisor、handoff | 群聊路由、选择器、人工或模型调度 |
| 上下文恢复 | Activation Prompt + 仓库文件 | 依赖框架记忆和状态 | 依赖 run/session 上下文 | 依赖 session/workflow 状态 | 依赖 graph checkpoint/state | 依赖会话历史和记忆 |
| 评审机制 | 发布者验收 + Roundtable 表决 | 可接入 guardrails/observability | 可在应用层自定义 | 可在 workflow 中自定义 | 可在图节点中自定义 | 常见为群聊讨论或人工介入 |
| 人类可读性 | 高，全部是 Markdown | 中，需要理解框架对象 | 中，需要理解 SDK 运行模型 | 中，需要理解框架和 workflow | 中，需要理解图结构 | 中，高度依赖对话记录质量 |
| 自动化程度 | 低到中，强调容错和可编辑 | 高 | 高 | 高 | 高 | 中到高 |
| 与 Kanban 的关系 | Kanban 是主线，Roundtable 松耦合 | 通常不以仓库 Kanban 为中心 | 通常不以仓库 Kanban 为中心 | 通常由 workflow 管理 | 通常由 graph 管理 | 通常由会话管理 |

### CrewAI

CrewAI 更偏“可运行的多 Agent 应用框架”，强调 Agents、Crews、Flows、Tasks & Processes，并提供 memory、knowledge、observability 等能力。本方案不运行 Agent，而是治理多个 CLI Agent 在仓库里的协作。

### OpenAI Agents SDK

OpenAI Agents SDK 的 handoff 是运行时对话或任务交接。本方案的 task assignment 是文件化工程任务交接，重点是跨会话恢复、任务责任边界和发布者验收。

### Microsoft Agent Framework

Microsoft Agent Framework 更接近生产 Agent 应用基础设施，强调 agents、tools、conversations、providers 和 workflows。本方案更接近 Mexus 中的 Agent Squad 操作协议。

### LangGraph / LangChain Multi-Agent

LangGraph 强在显式图结构、节点、边、状态和可恢复执行。本方案不要求把协作建模为状态机，而是用低成本 Markdown 让人和 Agent 都能直接读写。

### AutoGen / AgentChat

AutoGen / AgentChat 类方案强调多 Agent 对话、群聊、路由、工具调用和人类反馈。本方案把执行主线放在 Kanban，把需要讨论的方案放在 Roundtable，避免群聊上下文淹没任务状态。

## 7. 本方案的独特价值

### 1. Markdown Native

所有状态都在仓库内，Agent 和人都能直接读写。它不依赖额外服务，不需要复杂运行时，可被 Git 追踪，也适合不同 CLI Agent 共同使用。

### 2. Context Loss Recovery

每个 Agent 有稳定的 Activation Prompt，可在会话丢失后恢复身份、职责、任务入口、文件路径和完成规则。

### 3. Squad Lead 明确存在

很多多 Agent 框架强调 Agent 间自动协作，但在工程实践中仍需要一个 Squad Lead 控制边界、顺序和目标不漂移。

### 4. Kanban 与 Roundtable 分离

Kanban 是实践主线，Roundtable 是方案讨论。这避免了讨论阻塞执行主线，也避免执行任务里混入大量方案争论。

### 5. 发布者验收

任务由发布者验收，而不是由 Squad Lead 统一验收。这让依赖关系更清晰：谁提出需求，谁判断结果是否满足需求。

### 6. 可逐步演进

当前机制不预设 Mission 关闭规则，不强绑定 Roundtable 和 Kanban，也不假设所有 Agent 都能完美自动协作。先让机制在真实任务中跑起来，再根据实践补强。

### 7. 人力复用

`agent-team/agents.md` 让 Agent Team 从一次性分工变成可积累的团队。后续 Mission 可以根据模块经历复用 Agent，减少重新建立上下文的成本，也让 Mexus 能逐步形成“谁熟悉哪个模块”的长期记忆。

## 8. 风险与改进方向

### 风险

- Markdown 手动移动任务容易出现格式不一致。
- 多 Agent 同时编辑同一文件可能产生冲突。
- Roundtable 如果过度使用，会降低执行速度。
- 任务发布者如果不及时 Review，Done 区可能堆积未验收任务。
- Activation Prompt 如果创建时写得不准确，Agent 恢复时会误解自己的职责。

### 后续可改进

- 在实践后补充更清晰的 Review backlog 使用习惯。
- 在实践后沉淀常见 Mission 模板。
- 在实践后补充不同类型 Mission 的推荐 Agent 拆分模式。
- 在实践后补充跨 Agent 冲突处理案例。

## 9. 最终承载方式

这个方案最终可以有三种承载方式：

- 作为 Mexus 内置 Mission Workflow：由 Mexus 提供创建 Mission、查看 Kanban、查看 Roundtable、恢复 Agent 身份和发布任务的工作台能力。
- 作为 Agent Skill：把 `mission-workflow.md`、全局 Agent Roster、Mission 模板、Agent 命名规则、Kanban 模板和 Roundtable 模板封装成可复用技能，让不同 CLI Agent 都能按同一机制工作。
- 作为 Mexus Plugin：在保留 Markdown 作为事实源的前提下，提供更好的界面、任务领取入口、Roundtable 展示和 Agent 恢复入口。

这三种方式可以逐步演进：先用 Markdown 跑通真实协作，再沉淀为 Skill，最后在 Mexus 中产品化为 Plugin 或内置能力。

## 10. 结论

Agent Team Mission Workflow 是一个为 Mexus 设计的轻量 Agent Team 操作机制。它不像 CrewAI、OpenAI Agents SDK、Microsoft Agent Framework 或 LangGraph 那样运行 Agent，而是解决另一个实际问题：多个 CLI Agent 如何在同一仓库中围绕一个 Mission 分工、恢复上下文、流转任务、讨论方案和验收结果。

它适合当前 Agenticify 这种复杂产品 Mission：既需要多个 Agent 并行推进，又需要明确战略叙事、权限边界、协议演进和跨模块协作。

## 资料来源

- CrewAI Documentation: <https://docs.crewai.com/>
- OpenAI Agents SDK Handoffs: <https://openai.github.io/openai-agents-js/guides/handoffs/>
- Microsoft Agent Framework Documentation: <https://learn.microsoft.com/en-us/agent-framework/>
- Microsoft Agent Framework Workflow Agents: <https://learn.microsoft.com/en-us/agent-framework/workflows/as-agents>
- LangGraph Multi-Agent Systems: <https://langchain-ai.github.io/langgraph/concepts/multi_agent/>
