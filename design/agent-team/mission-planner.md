# Mission Planner — 创建流程升级方案(草案)

Status: **草案 / 未定**。本文档记录想法、未敲定的设计抉择,以及两种潜在执行模式的对比。不要据此实现。

## 背景

当前 `/mission-create` 只做两件事:复制 5 份空白 Markdown 模板,起一个 Squad Lead Pane。Team 阵容(`agents.md` 的 roster)、初始 kanban、每个 Agent 用什么 CLI 类型,全部由 Squad Lead 上岗后逐步建出来。

用户在过去几天的实际使用中观察到两件事:

1. **想要更前置的规划体验**:希望 mission 创建后,先由系统做一次任务分析与拆解,产出一个推荐的 Team 阵容(每个角色职责 + 任务难度 + 推荐 CLI Agent 类型),让用户在 Web 上确认并按需修改 Agent 类型后再一次性落盘。
2. **subAgent 模式效果也不错**:用过去两天,用 Claude Code 自带的 subAgent 工具按 `agent-team-workflow` 跑 mission,效果也很可用。这说明"Pane-only 承载"未必是唯一形态。

因此本方案需要重新思考两件事:**规划阶段如何做** 与 **执行阶段用什么承载**。

## 设想的新创建流程(规划阶段)

1. 用户输入 mission 意图(一段自然语言)
2. 系统以**非交互模式**调用一个 CLI Agent(planner)做任务分析,返回:
   - 拆解后的子任务集合
   - 推荐的 Team 阵容:每个角色的职责、估算难度、推荐 CLI Agent 类型(默认 = `mission_default_cli_agent`,planner 可基于难度提议升级)
3. Web UI 可视化呈现:阵容卡片网格,每张卡片可下拉切换 CLI Agent 类型
4. 用户确认 → 一次性写出 5 个 Markdown 文件(含完整 roster 与初始 kanban)
5. Squad Lead Pane(或 subAgent,见下文模式 B)上岗时阵容已就位

## 执行阶段的两种模式(开放问题)

这是用户重点要再想清楚的部分。

### 模式 A:Pane-only(当前 Phase 6 的默认假设)

- 每个 Mission Agent 都是一个真实的 Pane(node-pty + xterm.js)
- Squad Lead 通过 `/dispatch <agent>` 把 kanban 任务投递给对应 Pane
- 优点:多实例并行 / 用户可见可干预 / A2A inbox pipeline 已就绪
- 缺点:资源占用高(N 个 PTY 进程)、上手成本高、对轻量 mission 是 overkill

### 模式 B:subAgent-only(用户验证过实际可用)

- Squad Lead 是唯一的 CLI Agent 实例(可以是 Pane,也可以就是用户当前对话)
- 所有 Mission Agent 通过 Claude Code 自带的 Agent 工具(subAgent)承载,在 Squad Lead 的进程内调度
- 优点:零额外进程、极轻量、单一上下文、无须 plugin/REST/PTY 注入
- 缺点:无法真正并行(subAgent 是串行的)、用户看不到中间过程、A2A inbox 用不上

### 模式选择的判断维度

| 维度 | 模式 A(Pane) | 模式 B(subAgent) |
|---|---|---|
| 并发度 | 真并行 | 串行 |
| 可观测性 | 每个 Pane 独立终端 | 仅 Squad Lead 视角 |
| 资源 | N 个 PTY | 1 个 PTY |
| 启动成本 | 高 | 低 |
| 适用场景 | 长期 / 多人协作 / 重 mission | 个人 / 一次性 / 轻 mission |

### 候选策略

1. **用户在创建时选模式**:mission-create 多一个 "execution mode" 字段,planner 也据此调整推荐(模式 B 倾向单 Agent 全栈,模式 A 倾向多角色专精)
2. **planner 推荐 + 用户覆盖**:planner 根据估算难度与角色数量自动提议模式,用户可改
3. **混合**:某些角色用 Pane(需要长期在线 / 多轮调试),某些角色用 subAgent(一次性轻任务)。这条最灵活但复杂度最高

## Planner 通道设计(模式无关)

- 新增 `mexus mission plan --intent "<text>" --json`,服务端 spawn 一个 claudecode/codex 短进程,pipe stdin/stdout,读到 JSON 后退出
- 不复用 Pane(Pane 是 PTY 长连,planner 是短任务)
- Planner 是一次性纯函数:输入 intent,输出 JSON 阵容,跑完即弃
- Web 端通过 `POST /api/missions/plan` 触发

### 输出契约草案

```json
{
  "mission_name": "<slug>",
  "summary": "<one-line>",
  "execution_mode": "pane" | "subagent" | "hybrid",
  "agents": [
    {
      "name": "Bael",
      "role": "Backend implementor",
      "responsibilities": ["..."],
      "difficulty": "low" | "medium" | "high",
      "recommended_cli_agent": "claudecode" | "codex" | ...,
      "carrier": "pane" | "subagent",
      "activation_prompt": "..."
    }
  ],
  "initial_kanban": [
    { "to": "Bael", "request": "...", "reason": "...", "acceptance": "..." }
  ]
}
```

## 关键未决问题

1. **执行模式默认值**:Pane / subAgent / 让 planner 自己判断?
2. **subAgent 模式下,kanban 还有意义吗?** 模式 B 没有 A2A inbox,kanban 可能退化成 Squad Lead 自己的 TODO 而非真实通信渠道
3. **`/dispatch` 在模式 B 下的语义**:要不要重定义为"派发到 subAgent 工具"?还是模式 B 干脆没有 dispatch?
4. **planner JSON 不合 schema 的兜底**:zod 校验 + 重试 / 让用户手动改 / 退回空白模板
5. **难度评估的可信度披露**:UI 必须明确标注 "AI 估算,仅供参考"
6. **CLI 用户的体验一致性**:命令行没有可视化,模式 B 下也许可以直接命令行跑完;模式 A 下是否强制要求走 Web 确认?

## 与已有设计的关系

- 不冲突 `mexus-agent-team-plugin.md`:plugin 提供 slash command 入口,planner 是新增能力
- 模式 B 与现有 Phase 6.A(REST `/api/panes`)无关,但要补充设计 Phase 6.A 在模式 B 下"无 Pane 也能跑 mission"的退化路径
- 模式 B 与 Phase 5 inbox pipeline 不冲突:模式 B 不使用 inbox,模式 A 继续走 inbox

## 下一步(待用户决策)

- 用户继续思考两种模式的取舍后,本文档需要拆为两份或合并为一份正式方案
- 在敲定执行模式之前,**不要开始实现 planner**,避免推倒重来
