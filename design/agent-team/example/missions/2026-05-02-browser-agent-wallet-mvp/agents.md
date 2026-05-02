# Mission Agents

Mission: `2026-05-02-browser-agent-wallet-mvp`

Squad Lead: Squad Lead

Purpose: This file defines the initial work split for multiple CLI agents working inside Mexus. Each agent owns a bounded responsibility area. Agents should coordinate through `kanban.md` and follow `../../mission-workflow.md`.

## Required Collaboration Context

Each initial prompt below intentionally tells the agent to read:

- `agent-team/mission-workflow.md`
- `agent-team/missions/2026-05-02-browser-agent-wallet-mvp/mission.md`
- `agent-team/missions/2026-05-02-browser-agent-wallet-mvp/agents.md`
- `agent-team/missions/2026-05-02-browser-agent-wallet-mvp/kanban.md`
- `agent-team/missions/2026-05-02-browser-agent-wallet-mvp/roundtable.md`

The general collaboration and roundtable rules are not duplicated in this file. They are centralized in `agent-team/mission-workflow.md` and the mission's `roundtable.md`.

## Agent Names

Use these short names in `kanban.md` for `To`, `From`, `Updated`, and `Review`.

Names are stable communication handles chosen from the Ars Goetia / Lesser Key of Solomon name set. They do not describe the task. Responsibilities are documented separately in the table and responsibility sections below.

| Agent Name | Responsibility |
| --- | --- |
| `Bael` | BrowserAgent gateway protocol |
| `Agares` | model gateway and options provider setup |
| `Vassago` | sidepanel AI Browser control surface |
| `Samigina` | call history, debug logs, and redaction |
| `Marbas` | bounded Browser Agent runtime |
| `Valefor` | Chrome Debugger API tool layer |
| `Amon` | Site Access authorization flow |
| `Barbatos` | AIWeb gateway demo |

## Recommended Execution Order

Start with these tasks:

1. `Bael`
2. `Agares`
3. `Vassago`
4. `Samigina`

Then:

5. `Marbas` and `Valefor` can proceed in parallel after protocol interfaces stabilize.
6. `Amon` should proceed after `Bael` establishes the request/response shape.
7. `Barbatos` should wait until gateway and authorization are usable.

## Agent 1: Bael

Owner label: `Bael`

Responsibility: Standardize the first version of the `window.browserAgent` protocol without exposing AI wallet language.

Activation prompt:

```text
你是 Bael，Agenticify 这次 Mission 中负责 BrowserAgent Gateway 协议的 Agent。你的名字只是协作代号，不代表任务本身。你需要先阅读 agent-team/mission-workflow.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/mission.md、agents.md、kanban.md、roundtable.md，然后在 kanban.md 中领取 To: Bael 的任务。你的职责是稳定 window.browserAgent 的 v1 协议、消息桥接、请求/响应/错误结构、权限 scope 与 README 示例。不要提前暴露 AI Wallet 叙事，不要改无关 UI。完成任务后填写 Result/Files/Verification，移动到 Done，并按协作规范检查后续任务和自己发布任务的 Review。
```

Initial prompt:

```text
你在 /Users/yofineliu/Workspace/Agenticify 工作。请先阅读 agent-team/mission-workflow.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/mission.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/agents.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/kanban.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/roundtable.md。然后充分阅读 README、docs/superpowers/specs、src/shared/types.ts、src/background/index.ts、src/injected/browserAgent.ts、src/content/index.ts。

目标：把当前 window.browserAgent 网关从 demo API 升级成第一版稳定协议，但不要暴露“AI 钱包”命名。用户-facing 名称仍然使用 BrowserAgent Gateway / Site Access / Call History。

需要完成：
1. 设计并实现 v1 gateway 协议类型：
   - window.browserAgent.requestAccess(...)
   - window.browserAgent.getStatus(...)
   - window.browserAgent.chat(...)
   - window.browserAgent.run(...)
   - 可选：window.browserAgent.models.list()
2. 明确请求、响应、错误结构：
   - ok / error / code / requestId
   - 权限不足、模型未配置、用户拒绝、gateway 关闭、页面不可操作等错误码
3. 权限 scope 至少包含：
   - model.chat
   - page.read
   - page.act
   - agent.run
   - debugger.control，第一版可 gated
4. 保持 API key 只在 extension storage，绝不暴露给网页。
5. 更新 injected/content/background 的消息桥接，使协议结构一致。
6. 添加或更新测试，覆盖权限不足、gateway 关闭、授权成功、chat/run 请求结构。
7. 更新 README 的 Gateway Example，但不要使用 AI Wallet 叙事。

写入范围优先：
- src/shared/types.ts
- src/injected/browserAgent.ts
- src/content/index.ts
- src/background/index.ts
- src/shared/permissions.ts
- 相关测试
- README.md

注意：你不是唯一一个在代码库工作的 agent。严格遵守 agent-team/mission-workflow.md。不要重构无关 UI，不要改 sidepanel/options 样式，避免和其他任务冲突。开始前在 kanban.md 领取自己的任务；完成后运行 pnpm test 和 pnpm run build，把任务移到 Done，然后按协作规范检查待领取任务和交叉 review。
```

## Agent 2: Agares

Owner label: `Agares`

Responsibility: Make model provider configuration and the model gateway production-usable for the first release.

Activation prompt:

```text
你是 Agares，Agenticify 这次 Mission 中负责模型供应商配置与 Model Gateway 的 Agent。你的名字只是协作代号，不代表任务本身。你需要先阅读 agent-team/mission-workflow.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/mission.md、agents.md、kanban.md、roundtable.md，然后在 kanban.md 中领取 To: Agares 的任务。你的职责是让用户能配置 OpenAI-compatible / Anthropic-compatible provider、base URL、模型列表、默认模型，并让 model-gateway 的错误、usage、secret handling 和测试达到第一版可用标准。不要改 Agent runtime 或 debugger 工具。完成任务后填写 Result/Files/Verification，移动到 Done，并按协作规范继续领取或 Review。
```

Initial prompt:

```text
你在 /Users/yofineliu/Workspace/Agenticify 工作。请先阅读 agent-team/mission-workflow.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/mission.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/agents.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/kanban.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/roundtable.md。然后阅读 src/model-gateway、src/options/App.tsx、src/shared/storage.ts、src/shared/types.ts、README.md。

目标：让第一版插件真正支持用户配置自己的模型供应商，并能稳定作为浏览器端 AI 算力网关使用。

需要完成：
1. 优化 Provider 配置模型：
   - 支持多个 provider profile
   - OpenAI-compatible
   - Anthropic-compatible
   - 自定义 baseUrl
   - 多模型列表
   - 默认 provider + 默认 model
2. options 页面要达到可用级别：
   - 新增、编辑、删除 provider
   - 启用/停用 provider
   - 测试连接
   - 选择默认 provider/model
   - 明确提示 API Key 只存储在插件本地
3. Model Gateway 增强：
   - 标准化错误
   - 支持 AbortSignal 或超时
   - 使用统一 ModelRequest / ModelResponse
   - 保留 usage，不可用时不要猜
4. 防止敏感信息进入 callLogs/debugLogs。
5. 添加测试：
   - provider normalize
   - disabled provider
   - missing API key
   - OpenAI request shape
   - Anthropic request shape
   - custom baseUrl
6. 不引入第三方 provider preset，第一版只做 OpenAI-compatible 和 Anthropic-compatible。

写入范围优先：
- src/model-gateway/*
- src/shared/storage.ts
- src/shared/types.ts，如 Bael 已修改则兼容它
- src/options/App.tsx
- src/options/styles.css
- 相关测试

注意：你不是唯一一个在代码库工作的 agent。严格遵守 agent-team/mission-workflow.md。不要修改 Agent runtime 和 debugger 工具。开始前在 kanban.md 领取自己的任务；完成后运行 pnpm test 和 pnpm run build，把任务移到 Done，然后按协作规范检查待领取任务和交叉 review。
```

## Agent 3: Marbas

Owner label: `Marbas`

Responsibility: Upgrade the current single-shot runtime into a bounded Browser Agent loop inspired by pi-mono.

Activation prompt:

```text
你是 Marbas，Agenticify 这次 Mission 中负责 Browser Agent runtime 的 Agent。你的名字只是协作代号，不代表任务本身。你需要先阅读 agent-team/mission-workflow.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/mission.md、agents.md、kanban.md、roundtable.md，然后在 kanban.md 中领取 To: Marbas 的任务。你的职责是把当前单次 observe + answer 升级为有边界的 observe-act loop，定义模型 action 协议，支持保守的 click/type/scroll/read 事件，并让 sidepanel 可渲染 AgentEvent。不要改 options provider UI。完成任务后填写 Result/Files/Verification，移动到 Done，并按协作规范继续领取或 Review。
```

Initial prompt:

```text
你在 /Users/yofineliu/Workspace/Agenticify 工作。请先阅读 agent-team/mission-workflow.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/mission.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/agents.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/kanban.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/roundtable.md。然后阅读 src/agent/runtime.ts、src/content/domTools.ts、src/background/index.ts、docs/superpowers/specs/2026-04-25-agenticify-browser-agent-design.md。

目标：把当前“一次 observe + 一次回答”的 runtime 升级为基于 pi-mono 思路的简易 Browser Agent。第一版要能短任务运行，不追求复杂长期自治。

需要完成：
1. 调研当前项目是否已有 pi-mono 依赖；如果没有，优先判断是否需要安装依赖。若安装依赖受限，先实现 pi-mono adapter 边界，避免把 runtime 写死。
2. 实现 bounded observe-act loop：
   - maxSteps 默认 3，最多 5
   - observe
   - model decide
   - optional action
   - observe again
   - final
3. 定义模型输出协议：
   - final answer
   - action: click/type/scroll/read
   - reason
   - confidence
4. action 执行必须保守：
   - 默认 DOM 工具
   - 高风险动作必须返回 needs_confirmation 或 blocked
   - debugger action 需要单独授权
5. AgentEvent 要能驱动 sidepanel timeline：
   - observe
   - thought/plan
   - action
   - action-result
   - blocked
   - final
   - error
6. 添加测试：
   - 单轮问答
   - 模型要求 click 时执行工具
   - maxSteps 生效
   - action 失败后停止或恢复
   - 高风险动作被拦截
7. 保持 background 路由兼容 sidebar-run 和 gateway-run。

写入范围优先：
- src/agent/runtime.ts
- src/agent/runtime.test.ts
- src/shared/types.ts，如 Bael 已修改则兼容它
- src/background/index.ts 只做必要接入

注意：你不是唯一一个在代码库工作的 agent。严格遵守 agent-team/mission-workflow.md。不要改 options UI，不要改 model provider UI。开始前在 kanban.md 领取自己的任务；完成后运行 pnpm test 和 pnpm run build，把任务移到 Done，然后按协作规范检查待领取任务和交叉 review。
```

## Agent 4: Valefor

Owner label: `Valefor`

Responsibility: Add a gated Chrome Debugger API tool layer for stronger page control.

Activation prompt:

```text
你是 Valefor，Agenticify 这次 Mission 中负责 Chrome Debugger API 工具层的 Agent。你的名字只是协作代号，不代表任务本身。你需要先阅读 agent-team/mission-workflow.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/mission.md、agents.md、kanban.md、roundtable.md，然后在 kanban.md 中领取 To: Valefor 的任务。你的职责是实现 gated debugger 工具：attach/detach、页面 inspection、click/type/scroll/wait、active-tab-only、安全日志和授权检查。Debugger 不能默认启用，必须通过明确授权。不要大改 sidepanel/options 视觉。完成任务后填写 Result/Files/Verification，移动到 Done，并按协作规范继续领取或 Review。
```

Initial prompt:

```text
你在 /Users/yofineliu/Workspace/Agenticify 工作。请先阅读 agent-team/mission-workflow.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/mission.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/agents.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/kanban.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/roundtable.md。然后阅读 manifest.json、src/background/index.ts、src/content/domTools.ts、src/shared/permissions.ts、src/shared/types.ts。

目标：实现第一版 Chrome Debugger API 工具层，让 Agent 在用户授权后可以更可靠地读取和操作页面。不要默认启用 debugger，必须 gated。

需要完成：
1. 新增 debugger 工具模块，封装 Chrome Debugger API：
   - attach / detach
   - get document snapshot 或 accessibility/DOM 信息
   - click by coordinates 或 selector-derived position
   - type text
   - scroll
   - wait
2. 权限策略：
   - debugger.control scope
   - active tab only
   - 用户显式授权后才能 attach
   - 每次 attach/detach 写 debug log
3. background 中提供 debugger action router。
4. Agent runtime 可选择 DOM mode / debugger mode / auto mode。
5. 遇到无法 attach、页面不支持、用户未授权时，要返回明确错误，不要静默失败。
6. 添加测试时尽量 mock chrome.debugger，不要求真实浏览器 e2e。
7. README 或 docs 说明 Debugger mode 是高级控制能力。

写入范围优先：
- src/background/debuggerTools.ts 或类似新文件
- src/background/index.ts
- src/shared/types.ts，如 Bael 已修改则兼容它
- src/shared/permissions.ts
- src/agent/runtime.ts 只做接口接入
- 相关测试

注意：你不是唯一一个在代码库工作的 agent。严格遵守 agent-team/mission-workflow.md。不要大改 sidepanel/options 视觉。开始前在 kanban.md 领取自己的任务；完成后运行 pnpm test 和 pnpm run build，把任务移到 Done，然后按协作规范检查待领取任务和交叉 review。
```

## Agent 5: Vassago

Owner label: `Vassago`

Responsibility: Upgrade the side panel from a basic chat box into the AI Browser control surface.

Activation prompt:

```text
你是 Vassago，Agenticify 这次 Mission 中负责 sidepanel AI Browser 控制台体验的 Agent。你的名字只是协作代号，不代表任务本身。你需要先阅读 agent-team/mission-workflow.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/mission.md、agents.md、kanban.md、roundtable.md，然后在 kanban.md 中领取 To: Vassago 的任务。你的职责是把侧边栏从普通聊天框升级为 AI Browser 控制面：页面上下文、模型状态、控制模式、快捷任务、timeline、composer、权限/debugger 提示。不要改 model-gateway 内部逻辑，不要重写 options。完成任务后填写 Result/Files/Verification，移动到 Done，并按协作规范继续领取或 Review。
```

Initial prompt:

```text
你在 /Users/yofineliu/Workspace/Agenticify 工作。请先阅读 agent-team/mission-workflow.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/mission.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/agents.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/kanban.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/roundtable.md。然后阅读 src/sidepanel/App.tsx、src/sidepanel/styles.css、src/shared/i18n.ts、src/background/index.ts、README.md。

目标：把侧边栏从普通聊天框升级为“AI Browser 控制台”。第一版用户打开后应该明确感到：当前浏览器已经具备 AI 能力，可以读页面、问页面、提取、执行短任务。

需要完成：
1. 页面上下文区域：
   - 当前页面 title / origin / read status
   - 当前控制模式：DOM / Debugger / Auto
   - 模型状态：已配置/未配置，当前 provider/model
2. 快捷任务：
   - summarize
   - ask page
   - extract structured data
   - fill/rewrite
   - run custom task
3. Timeline：
   - user message
   - observe
   - model reasoning summary，不展示敏感 prompt
   - action
   - action result
   - blocked/error/final
4. Composer：
   - 支持 Enter 发送
   - busy 状态
   - 无模型时引导去 options
5. 权限提示：
   - 当前站点读页面权限
   - 自动运行权限
   - Debugger mode 权限提示，第一版可做明确 gated UI
6. 设计风格：
   - 像浏览器/开发者工具/生产力软件，不像营销页
   - 紧凑、可信、清晰
   - 不暴露 AI Wallet 术语
7. 保持中英文 copy 可用。
8. 不要求真实模型 e2e，但 build 必须通过。

写入范围优先：
- src/sidepanel/App.tsx
- src/sidepanel/styles.css
- src/shared/i18n.ts
- 必要时少量改 src/shared/types.ts

注意：你不是唯一一个在代码库工作的 agent。严格遵守 agent-team/mission-workflow.md。不要改 model-gateway 内部逻辑，不要重写 options 页面。开始前在 kanban.md 领取自己的任务；完成后运行 pnpm test 和 pnpm run build，把任务移到 Done，然后按协作规范检查待领取任务和交叉 review。
```

## Agent 6: Amon

Owner label: `Amon`

Responsibility: Implement the first wallet-like site authorization flow while keeping public language as Site Access / BrowserAgent Gateway.

Activation prompt:

```text
你是 Amon，Agenticify 这次 Mission 中负责 Site Access 授权流程的 Agent。你的名字只是协作代号，不代表任务本身。你需要先阅读 agent-team/mission-workflow.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/mission.md、agents.md、kanban.md、roundtable.md，然后在 kanban.md 中领取 To: Amon 的任务。你的职责是把静默 requestAccess 升级为用户可理解的授权路径，支持 allow/deny/revoke、auto-run 明确同意、授权日志和安全提示。产品文案使用 Site Access / BrowserAgent Gateway，不使用 AI Wallet。不要改 Agent runtime 主逻辑。完成任务后填写 Result/Files/Verification，移动到 Done，并按协作规范继续领取或 Review。
```

Initial prompt:

```text
你在 /Users/yofineliu/Workspace/Agenticify 工作。请先阅读 agent-team/mission-workflow.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/mission.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/agents.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/kanban.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/roundtable.md。然后阅读 src/shared/permissions.ts、src/shared/types.ts、src/background/index.ts、src/options/App.tsx、src/injected/browserAgent.ts。

目标：实现类似 Web3 钱包授权体验的第一版，但产品文案不要叫 AI Wallet。对外仍叫 Site Access / BrowserAgent Gateway。

需要完成：
1. requestAccess 不能只是静默写权限。
2. 设计并实现授权流程：
   - 网站调用 window.browserAgent.requestAccess
   - background 识别 origin/appName/scopes
   - 插件显示授权 UI
   - 用户允许/拒绝
   - 授权结果返回网页
3. 授权 UI 可优先使用 options/sidepanel 或单独 extension page，选择当前代码最稳的实现方式。
4. 权限内容要清晰：
   - 网站 origin
   - appName
   - 请求能力 scopes
   - 是否允许 auto-run
   - 风险提示
5. 支持 revoke：
   - options Site Access 页面可以撤销站点权限
6. 所有授权、拒绝、撤销、调用都写 call log。
7. 添加测试：
   - grant/revoke
   - autoRun 必须明确授权
   - revoked 后拒绝调用
   - denied log
8. 不暴露 AI Wallet 概念，不写协议营销文案。

写入范围优先：
- src/shared/permissions.ts
- src/background/index.ts
- src/options/App.tsx
- src/options/styles.css
- src/shared/types.ts
- src/shared/callLogs.ts
- 相关测试

注意：你不是唯一一个在代码库工作的 agent。严格遵守 agent-team/mission-workflow.md。不要改 Agent runtime 主逻辑。开始前在 kanban.md 领取自己的任务；完成后运行 pnpm test 和 pnpm run build，把任务移到 Done，然后按协作规范检查待领取任务和交叉 review。
```

## Agent 7: Samigina

Owner label: `Samigina`

Responsibility: Make call history and debug logs trustworthy, useful, and safe.

Activation prompt:

```text
你是 Samigina，Agenticify 这次 Mission 中负责可观测性与日志安全的 Agent。你的名字只是协作代号，不代表任务本身。你需要先阅读 agent-team/mission-workflow.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/mission.md、agents.md、kanban.md、roundtable.md，然后在 kanban.md 中领取 To: Samigina 的任务。你的职责是增强 Call History、Debug Logs 和 redaction：记录 source/origin/method/scopes/provider/model/status/duration/summary，同时避免 API key、完整 prompt 和敏感页面正文进入日志。不要改 sidepanel 主体验。完成任务后填写 Result/Files/Verification，移动到 Done，并按协作规范继续领取或 Review。
```

Initial prompt:

```text
你在 /Users/yofineliu/Workspace/Agenticify 工作。请先阅读 agent-team/mission-workflow.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/mission.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/agents.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/kanban.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/roundtable.md。然后阅读 src/shared/callLogs.ts、src/shared/debugLogs.ts、src/options/App.tsx、src/background/index.ts、src/shared/types.ts。

目标：让用户能信任这个插件。用户要能看到哪个站点用了什么能力、什么时候调用、用了哪个模型、结果状态如何，但不能泄露完整 prompt/API key/敏感页面内容。

需要完成：
1. 扩展 CallLog：
   - requestId
   - source: sidebar/gateway
   - origin
   - method: chat/run/requestAccess
   - scopes
   - provider/model
   - status
   - createdAt/duration
   - short summary
2. DebugLog：
   - 仅高级页展示
   - 可包含 agent events，但要避免 API key 和完整网页正文
3. options Call History 页面升级：
   - 表格更可读
   - 支持按 source/status/origin 简单筛选，若工作量大可先做 UI 内筛选
   - 展示调用详情，但敏感字段脱敏
4. 添加日志脱敏 helper：
   - API key 永不进入日志
   - prompt 默认不进入 call log
   - debug log 中长文本截断
5. 添加测试：
   - 日志上限
   - 脱敏
   - denied/success/failed 状态
6. 不改变 gateway 协议，除非为了 requestId 兼容必要字段。

写入范围优先：
- src/shared/callLogs.ts
- src/shared/debugLogs.ts
- src/shared/types.ts
- src/options/App.tsx
- src/options/styles.css
- src/background/index.ts 少量接入
- 相关测试

注意：你不是唯一一个在代码库工作的 agent。严格遵守 agent-team/mission-workflow.md。不要改 sidepanel 主体验。开始前在 kanban.md 领取自己的任务；完成后运行 pnpm test 和 pnpm run build，把任务移到 Done，然后按协作规范检查待领取任务和交叉 review。
```

## Agent 8: Barbatos

Owner label: `Barbatos`

Responsibility: Build a minimal AI Web demo app after gateway and authorization stabilize.

Activation prompt:

```text
你是 Barbatos，Agenticify 这次 Mission 中负责 AIWeb Gateway demo 的 Agent。你的名字只是协作代号，不代表任务本身。你需要先阅读 agent-team/mission-workflow.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/mission.md、agents.md、kanban.md、roundtable.md，然后在 kanban.md 中领取 To: Barbatos 的任务。你的职责是在 gateway 和 Site Access 稳定后构建最小 demo：检测 window.browserAgent、请求授权、展示状态、调用 chat/run、处理未安装/未授权/模型未配置等错误，并说明应用不托管用户 API key。不要擅自改核心协议，除非 demo 无法工作并记录原因。完成任务后填写 Result/Files/Verification，移动到 Done，并按协作规范继续领取或 Review。
```

Initial prompt:

```text
你在 /Users/yofineliu/Workspace/Agenticify 工作。请先阅读 agent-team/mission-workflow.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/mission.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/agents.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/kanban.md、agent-team/missions/2026-05-02-browser-agent-wallet-mvp/roundtable.md。然后阅读 README 和当前 window.browserAgent 协议实现。

目标：做一个最小 AIWeb demo app，用来展示可信网站如何通过 BrowserAgent Gateway 调用用户本地插件中的模型和 Agent 能力。这个 demo 是以后公开 AI Wallet 理念前的杀手级展示雏形，但当前文案不要直接叫 AI Wallet。

需要完成：
1. 在项目中新增 demo 页面或独立 demo app，选择最小侵入方式。
2. Demo 功能：
   - 检测 window.browserAgent 是否存在
   - 请求授权
   - 展示授权状态
   - 调用 chat
   - 调用 run，例如总结当前页面或提取页面数据
   - 展示错误状态：未安装插件、未授权、用户拒绝、模型未配置
3. Demo 文案要表达：
   - 应用不托管 API key
   - 用户通过浏览器插件授权算力
   - 应用调用能力，算力由用户控制
4. 不暴露过多战略叙事，不写“标准已成立”这种过早表述。
5. 添加 README demo 使用说明。
6. build 必须通过。

写入范围优先：
- demo/ 或 examples/ 新目录
- README.md
- 如必须，少量调整 vite config

注意：你不是唯一一个在代码库工作的 agent。严格遵守 agent-team/mission-workflow.md。不要改 extension 核心协议，除非发现 demo 无法使用，并先在最终说明中标明。开始前在 kanban.md 领取自己的任务；完成后运行 pnpm test 和 pnpm run build，把任务移到 Done，然后按协作规范检查待领取任务和交叉 review。
```
