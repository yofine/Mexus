# Agent Team Kanban

Mission: `2026-05-02-haro-sidepanel-streaming`

Board owner: Squad Lead

Last updated: 2026-05-02

## Board Usage Rules

This file is only for task state tracking. General collaboration rules live in `../../mission-workflow.md`.

### Status Flow

- `To Claim`: the task is ready for the `To` owner.
- `In Progress`: one agent has claimed the task and is actively working on it.
- `Done`: implementation is finished and the `To` agent has filled `Result`, `Files`, and `Verification`.

Agents should move a task through the board by moving the full task block under the correct status section.

### Task Format

Use this format for every task:

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

## To Claim

To: Bael | From: Squad Lead | Scope: `src/shared/types.ts`, `src/background/index.ts`, limited `src/sidepanel/App.tsx`, related tests
- Ref: b7a4c19
- Request: Define and implement the sidepanel/background streaming transport for Haro runs. Add typed stream request and stream event shapes for `observe`, `reasoning-summary`, `action`, `action-result`, `assistant-delta`, `assistant-final`, `blocked`, and `error`. Use `chrome.runtime.connect` Port or an equivalent long-lived event channel. Keep the existing `agenticify:sidebar-run` / `sendMessage` route as a compatible fallback.
- Reason: The current `sendMessage` path cannot deliver progressive events, so sidepanel cannot show a real streaming Haro reply or live tool timeline.
- Acceptance: A sidepanel stream route exists and can emit typed events over a long-lived channel. Existing `agenticify:sidebar-run` behavior remains unchanged. Stream events do not include raw prompts, API keys, or full page text. Tests cover protocol/route success and fallback compatibility where practical.
- Result:
- Files:
- Verification:
- Review:
- Updated: 2026-05-02, Squad Lead

To: Agares | From: Squad Lead | Scope: `src/model-gateway/index.ts`, `src/model-gateway/openai.ts`, `src/model-gateway/anthropic.ts`, `src/shared/types.ts`, `src/model-gateway/index.test.ts`
- Ref: e2c9f6a
- Request: Add model gateway streaming capability detection and real provider streaming support where practical. Only emit `assistant-delta` from real provider streaming APIs. When a provider or route does not support streaming, return an explicit fallback/unsupported signal so upper layers use non-streaming chat without faking deltas.
- Reason: The product goal requires true streaming, but the mission explicitly forbids pretending that a non-streaming provider response is token streaming.
- Acceptance: Model gateway can distinguish real streaming from fallback. OpenAI-compatible and Anthropic-compatible streaming paths are implemented or explicitly marked unsupported with tests. Existing non-streaming `callModel` behavior remains compatible. Secrets and raw prompts are not logged.
- Result:
- Files:
- Verification:
- Review:
- Updated: 2026-05-02, Squad Lead

To: Marbas | From: Squad Lead | Scope: `src/agent/runtime.ts`, `src/agent/runtime.test.ts`, `src/shared/types.ts`, limited `src/background/index.ts`
- Ref: 4d8e1b7
- Request: Add safe progressive event emission to `runPageChat`, `runMemoryChat`, and `runAgentTask`. Emit observe/action/action-result/blocked/error/final events as they happen, map safe model-facing summaries to `reasoning-summary`, and pass through `assistant-delta` only when the model gateway supplies real streaming deltas. Keep final `{ finalText, events }` return compatibility.
- Reason: Background streaming transport needs runtime events before final completion, while old callers still depend on the final result shape.
- Acceptance: Runtime supports an optional event callback or equivalent stream interface. Tests cover event order, assistant delta pass-through with real streaming gateway mocks, non-streaming fallback, blocked/error events, and no raw chain-of-thought exposure.
- Result:
- Files:
- Verification:
- Review:
- Updated: 2026-05-02, Squad Lead

To: Vassago | From: Squad Lead | Scope: `src/sidepanel/App.tsx`, `src/sidepanel/styles.css`, `src/sidepanel/App.test.ts`, `src/shared/i18n.ts`, `src/shared/types.ts`
- Ref: a9c3d02
- Request: Upgrade sidepanel conversation UI to consume the stream channel. On submit or quick action, immediately append the user bubble and create a Haro pending assistant message. Merge `assistant-delta` into the same assistant message, render timeline events progressively, finalize on `assistant-final`, and show blocked/error states. Preserve sendMessage fallback when streaming is unavailable or unsupported.
- Reason: This is the user-visible core of the Mission: Haro must feel alive and streaming instead of waiting for a complete final reply.
- Acceptance: Tests cover immediate user bubble, pending Haro placeholder, delta merge into a single assistant reply, final convergence, timeline event rendering, fallback path, error path, and bottom-follow behavior. UI does not show raw prompt or chain-of-thought. `pnpm test` and `pnpm run build` pass.
- Result:
- Files:
- Verification:
- Review:
- Updated: 2026-05-02, Squad Lead

To: Samigina | From: Squad Lead | Scope: `src/shared/callLogs.ts`, `src/shared/debugLogs.ts`, `src/shared/types.ts`, `src/background/index.ts`, related tests
- Ref: f6b1a80
- Request: Add streaming safety and observability coverage. Ensure stream events, call logs, debug logs, and memory persistence do not include API keys, raw prompts, raw messages, full page text, or chain-of-thought. Distinguish streaming success, fallback, provider unsupported, blocked, and error states where logs currently support it.
- Reason: Streaming introduces more intermediate data surfaces; safety and trust must stay intact while preserving useful observability.
- Acceptance: Redaction/log tests cover stream events and fallback/error statuses. Automatic memory persistence uses final assistant text only. Debug details do not contain sensitive prompts or full page text. Existing log behavior remains compatible. `pnpm test` and `pnpm run build` pass.
- Result:
- Files:
- Verification:
- Review:
- Updated: 2026-05-02, Squad Lead

## In Progress

No tasks claimed yet.

## Done

No tasks completed yet.
