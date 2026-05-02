# Mission: Haro Sidepanel Streaming Conversation

Mission: `2026-05-02-haro-sidepanel-streaming`

Created by: Squad Lead

Created at: 2026-05-02

## Original Request

把 Haro sidepanel 当前“一次性等待完整回复再显示”的对话模式，升级为真实流式 AI 对话。

核心问题：

- 现在 sidepanel 通过 `chrome.runtime.sendMessage()` 发起任务。
- background 等模型完整返回 `finalText` 后才一次性回传。
- 所以 UI 只能一次性显示整段 Haro 回复。
- 自动滚动到底部后，这个非流式问题更明显。

目标体验：

- 用户输入或点击快捷操作后，立即出现用户气泡。
- 同时创建一条 Haro 回复占位，显示“思考中”。
- 随着模型返回内容，Haro 回复逐步增量更新。
- 页面观察、工具调用、动作结果、最终回复都能逐步进入 timeline。

技术方向：

- 新增 sidepanel 与 background 的长连接或事件通道。
- 支持事件类型：
  - `observe`
  - `reasoning-summary`
  - `action`
  - `action-result`
  - `assistant-delta`
  - `assistant-final`
  - `blocked`
  - `error`
- 不暴露敏感 prompt，不展示 chain-of-thought。
- 保留现有非流式 `agenticify:sidebar-run` / `sendMessage` 路径作为兼容 fallback。
- 如果底层 provider 暂不支持真实 streaming，要明确走 fallback，不能伪装成真实 token stream。
- 最终 `pnpm test` 和 `pnpm run build` 必须通过。

## Mission Intent

Upgrade Haro sidepanel from request/complete-response chat to real streaming conversation where user intent appears immediately, Haro has a visible pending reply, model/tool/agent events arrive progressively, and existing non-streaming behavior remains as a reliable fallback.

## Current Code Context

- `src/sidepanel/App.tsx` uses `sendRuntimeMessage` over `chrome.runtime.sendMessage`.
- `src/sidepanel/App.tsx` calls `agenticify:sidebar-run` and appends formatted events only after the full result returns.
- `src/background/index.ts` handles `agenticify:sidebar-run` by awaiting `runTask(...)`.
- `src/background/index.ts` persists memories and logs only after `result.finalText` is available.
- `src/agent/runtime.ts` returns `{ finalText, events }` after model calls and actions finish.
- `src/shared/types.ts` currently defines `AgentEvent` with `observe`, `thought`, `plan`, `action`, `action-result`, `blocked`, and `final`.
- `src/model-gateway/openai.ts` and `src/model-gateway/anthropic.ts` currently use non-streaming provider calls.

## Strategic Constraints

- Do not expose hidden prompts or chain-of-thought.
- `reasoning-summary` must be a safe user-facing summary, not raw model reasoning.
- Do not fake streaming when the provider path is non-streaming.
- Keep `agenticify:sidebar-run` and `chrome.runtime.sendMessage` fallback working.
- Keep API keys and sensitive prompt/page content out of stream events and logs.
- Prefer a small protocol that can later support gateway streaming, but this Mission is sidepanel-first.

## Implementation Order

1. Define the streaming protocol and sidepanel/background transport shape.
2. Add model gateway streaming capability detection and provider streaming where supported.
3. Add runtime event emission hooks so observe/action/final/error can stream progressively.
4. Upgrade sidepanel UI state to show pending assistant reply, assistant deltas, and event timeline.
5. Add safety, logging, fallback, and regression tests.

## Minimum Acceptance Standard

- Starting a run immediately appends the user message and a Haro pending reply.
- Real streaming provider paths produce `assistant-delta` events and update the same assistant reply progressively.
- Non-streaming provider paths explicitly use fallback and do not emit fake token deltas.
- `observe`, `reasoning-summary`, `action`, `action-result`, `assistant-final`, `blocked`, and `error` can be represented in the sidepanel timeline.
- Existing `agenticify:sidebar-run` / `sendMessage` behavior remains compatible.
- Sensitive prompt content and raw chain-of-thought are not streamed or logged.
- `pnpm test` and `pnpm run build` pass.
