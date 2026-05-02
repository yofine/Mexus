# Mission Agents

Mission: `2026-05-02-haro-sidepanel-streaming`

Squad Lead: Squad Lead

Purpose: This file defines the work split for upgrading Haro sidepanel to true streaming AI conversation. Agents are reused from `agent-team/agents.md` based on existing module history.

## Required Collaboration Context

Each agent should read:

- `agent-team/mission-workflow.md`
- `agent-team/agents.md`
- `agent-team/missions/2026-05-02-haro-sidepanel-streaming/mission.md`
- `agent-team/missions/2026-05-02-haro-sidepanel-streaming/agents.md`
- `agent-team/missions/2026-05-02-haro-sidepanel-streaming/kanban.md`
- `agent-team/missions/2026-05-02-haro-sidepanel-streaming/roundtable.md`

## Agent Names

| Agent Name | Responsibility In This Mission | Reuse Reason |
| --- | --- | --- |
| `Bael` | sidepanel/background streaming protocol and compatibility route | Existing owner for gateway/message protocol and background bridge surfaces. |
| `Agares` | provider streaming capability and fallback behavior | Existing owner for model gateway and provider behavior. |
| `Marbas` | Agent runtime streaming event emission | Existing owner for Browser Agent runtime loop and AgentEvent semantics. |
| `Vassago` | sidepanel streaming conversation UI | Existing owner for sidepanel AI Browser control surface. |
| `Samigina` | stream safety, redaction, logs, and regression coverage | Existing owner for call history, debug logs, and redaction. |

## Recommended Execution Order

1. `Bael` and `Agares` can start first.
2. `Marbas` starts after the event/protocol shape is clear enough to integrate.
3. `Vassago` starts after Bael defines the sidepanel stream transport contract.
4. `Samigina` can start with safety requirements early, then finish after other tasks expose final stream event shapes.

## Agent: Bael

Owner label: `Bael`

Responsibility: Define and implement the sidepanel/background streaming transport while keeping the old `agenticify:sidebar-run` path as fallback.

Activation prompt:

```text
你是 Bael，负责 mission `2026-05-02-haro-sidepanel-streaming` 中的 sidepanel/background streaming protocol。你的名字只是协作代号，不代表任务本身。先阅读 agent-team/mission-workflow.md、agent-team/agents.md、本 mission 的 mission.md、agents.md、kanban.md、roundtable.md，然后在 kanban.md 中领取 To: Bael 的任务。你的职责是定义 Haro sidepanel streaming 的事件通道、消息类型、生命周期、兼容 fallback 和错误收敛。不要改 provider 实现，不要大改 UI。完成后填写 Result/Files/Verification，移动到 Done，并检查自己发布任务的 Review。
```

Initial prompt:

```text
你在 /Users/yofineliu/Workspace/Agenticify 工作。请先阅读 agent-team/mission-workflow.md、agent-team/agents.md、agent-team/missions/2026-05-02-haro-sidepanel-streaming/mission.md、agents.md、kanban.md、roundtable.md。然后阅读 src/shared/types.ts、src/background/index.ts、src/sidepanel/App.tsx、src/sidepanel/App.test.ts。

目标：为 Haro sidepanel 新增真实 streaming 的 background 通道，同时保留 agenticify:sidebar-run / chrome.runtime.sendMessage 的非流式 fallback。

重点：
1. 设计类型：stream request、stream event、stream done/error、fallback result。
2. 优先考虑 chrome.runtime.connect Port 或等价长连接，避免用 sendMessage 伪装流。
3. 事件类型至少覆盖 observe、reasoning-summary、action、action-result、assistant-delta、assistant-final、blocked、error。
4. 旧 agenticify:sidebar-run 路径必须保持兼容。
5. 不能把 prompt、raw messages、API key、完整 page text 放进 stream event。
6. 添加或更新协议/background route 测试。

写入范围优先：
- src/shared/types.ts
- src/background/index.ts
- src/sidepanel/App.tsx 中与连接调用相关的最小类型对接
- src/sidepanel/App.test.ts 或 background 相关测试

注意：你不是唯一一个在代码库工作的 agent。不要重写 provider、runtime 主逻辑或 sidepanel 视觉。开始前领取任务；完成后运行 pnpm test 和 pnpm run build。
```

## Agent: Agares

Owner label: `Agares`

Responsibility: Add provider-level streaming capability and explicit non-streaming fallback semantics.

Activation prompt:

```text
你是 Agares，负责 mission `2026-05-02-haro-sidepanel-streaming` 中的 model gateway streaming 能力。先阅读协作文件和本 mission 文件，然后领取 To: Agares 的任务。你的职责是让 provider 明确支持或不支持真实 streaming，OpenAI/Anthropic 可支持时走真实 stream，不支持时明确 fallback，不能伪造 token stream。不要改 sidepanel UI。完成后填写 Result/Files/Verification，移动到 Done，并检查自己发布任务的 Review。
```

Initial prompt:

```text
你在 /Users/yofineliu/Workspace/Agenticify 工作。请先阅读 agent-team/mission-workflow.md、agent-team/agents.md、agent-team/missions/2026-05-02-haro-sidepanel-streaming/mission.md、agents.md、kanban.md、roundtable.md。然后阅读 src/model-gateway/index.ts、openai.ts、anthropic.ts、src/shared/types.ts、src/model-gateway/index.test.ts。

目标：为 model gateway 增加真实 streaming 能力和 capability/fallback 表达。

重点：
1. 扩展 ModelGateway 或新增 streaming 方法，能以 async iterable/callback 形式输出真实 delta。
2. OpenAI-compatible provider 只有在使用 provider streaming endpoint/SSE 时才输出 assistant-delta。
3. Anthropic-compatible provider 同理，解析真实 streaming event 后输出 delta。
4. 对暂不支持或配置不支持的路径，返回明确 non-streaming fallback 标记，由上层走旧 chat，不发 assistant-delta。
5. 保留现有 callModel/chat 测试和行为。
6. 不记录 API key、raw prompt、完整 raw provider payload。

写入范围优先：
- src/shared/types.ts
- src/model-gateway/index.ts
- src/model-gateway/openai.ts
- src/model-gateway/anthropic.ts
- src/model-gateway/index.test.ts

注意：不要改 sidepanel UI 或 background routing 之外的逻辑。完成后运行 pnpm test 和 pnpm run build。
```

## Agent: Marbas

Owner label: `Marbas`

Responsibility: Upgrade Agent runtime to emit safe streaming events progressively.

Activation prompt:

```text
你是 Marbas，负责 mission `2026-05-02-haro-sidepanel-streaming` 中的 Agent runtime streaming event。先阅读协作文件和本 mission 文件，然后领取 To: Marbas 的任务。你的职责是让 runPageChat、runMemoryChat、runAgentTask 支持安全事件回调或 async event stream，逐步发出 observe、reasoning-summary、action、action-result、assistant-final、blocked、error，并在真实 provider streaming 可用时透传 assistant-delta。不要暴露 chain-of-thought。完成后填写 Result/Files/Verification，移动到 Done。
```

Initial prompt:

```text
你在 /Users/yofineliu/Workspace/Agenticify 工作。请先阅读 agent-team/mission-workflow.md、agent-team/agents.md、agent-team/missions/2026-05-02-haro-sidepanel-streaming/mission.md、agents.md、kanban.md、roundtable.md。然后阅读 src/agent/runtime.ts、src/agent/runtime.test.ts、src/shared/types.ts、src/background/index.ts。

目标：让 Agent runtime 在保持返回 final result 的同时，支持向 background streaming 通道逐步发出事件。

重点：
1. 为 runPageChat、runMemoryChat、runAgentTask 增加可选 onEvent 或等价流式接口。
2. observe 后立即发 observe。
3. 模型动作决策只发安全 reasoning-summary，不发 raw thought / chain-of-thought。
4. action 和 action-result 逐步发出。
5. 如果 model gateway 提供真实 delta，转成 assistant-delta；最终收敛为 assistant-final。
6. blocked/error 要能进入 stream，同时旧 finalText 返回保持兼容。
7. 更新 runtime tests 覆盖事件顺序、fallback、不泄露 raw prompt/CoT。

写入范围优先：
- src/agent/runtime.ts
- src/agent/runtime.test.ts
- src/shared/types.ts
- limited src/background/index.ts

注意：不要改 sidepanel 视觉，不要重写 provider 实现。完成后运行 pnpm test 和 pnpm run build。
```

## Agent: Vassago

Owner label: `Vassago`

Responsibility: Implement the sidepanel streaming conversation experience.

Activation prompt:

```text
你是 Vassago，负责 mission `2026-05-02-haro-sidepanel-streaming` 中的 Haro sidepanel streaming UI。先阅读协作文件和本 mission 文件，然后领取 To: Vassago 的任务。你的职责是让用户提交后立即出现用户气泡和 Haro 思考中占位，随后根据 stream event 增量更新同一条 Haro 回复和 timeline。保留 fallback 路径。完成后填写 Result/Files/Verification，移动到 Done。
```

Initial prompt:

```text
你在 /Users/yofineliu/Workspace/Agenticify 工作。请先阅读 agent-team/mission-workflow.md、agent-team/agents.md、agent-team/missions/2026-05-02-haro-sidepanel-streaming/mission.md、agents.md、kanban.md、roundtable.md。然后阅读 src/sidepanel/App.tsx、src/sidepanel/styles.css、src/sidepanel/App.test.ts、src/shared/i18n.ts、src/shared/types.ts。

目标：把 Haro sidepanel 从等待完整回复改成 streaming conversation UI。

重点：
1. 用户提交或快捷操作触发后，立即追加 user bubble。
2. 同时创建 Haro assistant 占位，显示 thinking/思考中状态。
3. assistant-delta 更新同一条 assistant 消息，不创建多条碎片消息。
4. observe、reasoning-summary、action、action-result、blocked、error 进入 timeline，assistant-final 收敛最终文本。
5. 自动滚动只在用户位于底部附近时跟随，不打断用户向上查看历史。
6. streaming 失败或不支持时走现有 sendMessage fallback，并明确 UI 状态。
7. 补齐 App.test 覆盖占位、delta 合并、final 收敛、fallback、error。

写入范围优先：
- src/sidepanel/App.tsx
- src/sidepanel/styles.css
- src/sidepanel/App.test.ts
- src/shared/i18n.ts
- src/shared/types.ts

注意：不要改 provider 实现和 runtime 主逻辑。完成后运行 pnpm test 和 pnpm run build。
```

## Agent: Samigina

Owner label: `Samigina`

Responsibility: Ensure streaming events, logs, and tests preserve safety and observability.

Activation prompt:

```text
你是 Samigina，负责 mission `2026-05-02-haro-sidepanel-streaming` 中的 streaming 安全、日志和回归测试。先阅读协作文件和本 mission 文件，然后领取 To: Samigina 的任务。你的职责是确保 stream event 和日志不暴露 API key、raw prompt、完整页面正文或 chain-of-thought，并让 call/debug logs 能表达 streaming/fallback/error 状态。完成后填写 Result/Files/Verification，移动到 Done。
```

Initial prompt:

```text
你在 /Users/yofineliu/Workspace/Agenticify 工作。请先阅读 agent-team/mission-workflow.md、agent-team/agents.md、agent-team/missions/2026-05-02-haro-sidepanel-streaming/mission.md、agents.md、kanban.md、roundtable.md。然后阅读 src/shared/callLogs.ts、src/shared/debugLogs.ts、src/shared/types.ts、src/background/index.ts、相关 tests。

目标：补齐 streaming conversation 的安全与观测边界。

重点：
1. stream event、debug log、call log 不包含 API key、raw prompt、完整 raw messages、完整 page text。
2. reasoning-summary 是安全摘要，不是 chain-of-thought。
3. streaming success、fallback、provider unsupported、blocked、error 状态可在日志中区分。
4. 保持自动记忆只基于最终 assistant-final/finalText，不基于中间 delta。
5. 补齐 redaction 和 log tests。

写入范围优先：
- src/shared/callLogs.ts
- src/shared/debugLogs.ts
- src/shared/types.ts
- src/background/index.ts
- related tests

注意：不要改 sidepanel 视觉，不要实现 provider streaming。完成后运行 pnpm test 和 pnpm run build。
```
