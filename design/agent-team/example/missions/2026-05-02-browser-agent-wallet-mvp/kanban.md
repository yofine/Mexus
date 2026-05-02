# Agent Team Kanban

Mission: `2026-05-02-browser-agent-wallet-mvp`

Board owner: Squad Lead

Last updated: 2026-05-02

## Board Usage Rules

This file is only for task state tracking. General collaboration rules live in `../../mission-workflow.md`.

### Status Flow

- `To Claim`: the task is ready for the `To` owner.
- `In Progress`: one agent has claimed the task and is actively working on it.
- `Done`: implementation is finished and the `To` agent has filled `Result`, `Files`, and `Verification`.

Agents should move a task through the board by cutting the full task block and pasting it under the correct status section.

### Claiming A Task

When claiming a task:

- move it from `To Claim` to `In Progress`
- update `Updated`
- keep `To`, `From`, and `Scope` visible

### Completing A Task

When completing a task:

- move it from `In Progress` to `Done`
- fill `Result`
- fill `Files`
- fill `Verification`
- update `Updated`

### Publishing A New Task

When publishing a new task:

- add it under `To Claim`
- use the next available task id for the relevant area
- set `From` to the publishing agent
- set `To` to the expected owner
- set `Scope` to the involved path/module
- set a short git-commit-like `Ref`
- include concrete `Request`, `Reason`, and `Acceptance`
- leave `Result`, `Files`, `Verification`, and `Review` empty for the responsible agents to fill later
- set `Updated`

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

To: Bael | From: Squad Lead | Scope: `src/shared/types.ts`, `src/injected/browserAgent.ts`, `src/content/index.ts`, `src/background/index.ts`, `src/shared/permissions.ts`, related tests, `README.md`
- Ref: a3f9c2d
- Request: Upgrade `window.browserAgent` from a demo bridge into a typed v1 protocol. Include `requestAccess`, `getStatus`, `chat`, `run`, and optionally `models.list`. Define consistent response and error shape with `ok`, `requestId`, error code, and useful messages. Cover gateway disabled, unauthorized, authorized, chat, and run behavior where practical. Keep product language as BrowserAgent Gateway / Site Access / Call History.
- Reason: Other work depends on a stable gateway contract, especially authorization, observability, runtime integration, and the future demo app.
- Acceptance: `requestAccess`, `getStatus`, `chat`, and `run` have typed v1 protocol shapes. Gateway responses include consistent `ok`, `requestId`, and error code behavior. API keys remain extension-only and are not exposed to webpages. Tests cover the main authorization and call paths where practical.
- Result:
- Files:
- Verification:
- Review:
- Updated: 2026-05-02, Squad Lead

To: Agares | From: Squad Lead | Scope: `src/model-gateway/*`, `src/shared/storage.ts`, `src/shared/types.ts`, `src/options/App.tsx`, `src/options/styles.css`, related tests
- Ref: 7b1e4a9
- Request: Make provider setup usable for first release. Support multiple OpenAI-compatible and Anthropic-compatible provider profiles, custom base URLs, model lists, enable/disable, edit/delete, connection test, and default provider/model selection. Standardize model gateway errors and preserve usage data without guessing. Prevent secrets from entering logs.
- Reason: The Browser Agent value depends on users safely bringing their own model credentials and routing model calls through a trustworthy local gateway.
- Acceptance: Options UI supports provider profile management and default selection. model gateway handles disabled provider, missing API key, OpenAI request shape, Anthropic request shape, and custom base URL. Sensitive values do not enter logs. `pnpm test` and `pnpm run build` pass.
- Result:
- Files:
- Verification:
- Review:
- Updated: 2026-05-02, Squad Lead

To: Vassago | From: Squad Lead | Scope: `src/sidepanel/App.tsx`, `src/sidepanel/styles.css`, `src/shared/i18n.ts`, optionally `src/shared/types.ts`
- Ref: c0d8f31
- Request: Upgrade the side panel from a basic chat box into an AI Browser control surface. Show page context, read status, control mode, current provider/model status, quick actions, timeline events, composer state, and permission/debugger prompts. Keep UI compact, trustworthy, and product-focused without AI Wallet terminology.
- Reason: The first release must win ordinary users through a useful Browser Agent surface before exposing the deeper AI wallet strategy.
- Acceptance: Sidepanel clearly communicates AI Browser capability, represents observe/model/action/result/error/final states, guides users to options when no model is configured, and passes `pnpm test` plus `pnpm run build`.
- Result:
- Files:
- Verification:
- Review:
- Updated: 2026-05-02, Squad Lead

To: Samigina | From: Squad Lead | Scope: `src/shared/callLogs.ts`, `src/shared/debugLogs.ts`, `src/shared/types.ts`, `src/options/App.tsx`, `src/options/styles.css`, `src/background/index.ts`, related tests
- Ref: 4e6a92b
- Request: Extend call logs with request id, source, origin, method, scopes, provider/model, status, duration, and short summary. Add safe debug log rendering and redaction helpers. Improve options call history with readable rows, basic filters if practical, and safe detail display.
- Reason: Users must be able to trust the extension by seeing which site used which capability, while secrets and sensitive page/prompt contents remain protected.
- Acceptance: Logs distinguish denied, failed, and successful calls. API keys, full prompts, and long sensitive page text are not logged. Tests cover log limits, redaction, and key statuses. `pnpm test` and `pnpm run build` pass.
- Result:
- Files:
- Verification:
- Review:
- Updated: 2026-05-02, Squad Lead

To: Marbas | From: Squad Lead | Scope: `src/agent/runtime.ts`, `src/agent/runtime.test.ts`, `src/shared/types.ts`, limited `src/background/index.ts`
- Ref: 9f2b7c0
- Request: Upgrade runtime from single-shot observe plus answer into a bounded pi-mono-inspired observe-act loop. Define model action protocol with final answer, click/type/scroll/read actions, reason, and confidence. Keep actions conservative, block high-risk operations, and expose events the sidepanel can render.
- Reason: The product cannot meet the Browser Agent promise if `run` only reads the page and returns text.
- Acceptance: Runtime supports bounded observe-act-final flow. `click`, `type`, `scroll`, and read-like behavior are represented. High-risk actions are blocked or require confirmation. Tests cover single-turn answer, action execution, max steps, action failure, and high-risk blocking. `pnpm test` and `pnpm run build` pass.
- Result:
- Files:
- Verification:
- Review:
- Updated: 2026-05-02, Squad Lead

To: Valefor | From: Squad Lead | Scope: `src/background/debuggerTools.ts` or equivalent, `src/background/index.ts`, `src/shared/types.ts`, `src/shared/permissions.ts`, limited `src/agent/runtime.ts`, related tests
- Ref: d14e8f6
- Request: Add a gated Chrome Debugger API wrapper for advanced page inspection and operation. Include attach/detach, snapshot or DOM/accessibility inspection, click, type, scroll, and wait. Enforce active-tab-only behavior and `debugger.control` authorization. Log attach/detach and failures safely.
- Reason: DOM tools are not enough for reliable browser operation; Debugger API is the advanced control path, but it must be explicitly gated.
- Acceptance: Debugger mode is never default. Active-tab-only attach behavior is enforced. Attach/detach and failures are logged safely. Mocked tests cover core debugger wrapper behavior where practical. `pnpm test` and `pnpm run build` pass.
- Result:
- Files:
- Verification:
- Review:
- Updated: 2026-05-02, Squad Lead

To: Amon | From: Squad Lead | Scope: `src/shared/permissions.ts`, `src/background/index.ts`, `src/options/App.tsx`, `src/options/styles.css`, `src/shared/types.ts`, `src/shared/callLogs.ts`, related tests
- Ref: 6c9a0e5
- Request: Replace silent `requestAccess` behavior with a user-understandable Site Access authorization path. Show origin, app name, requested scopes, auto-run request, and risk text. Support allow, deny, revoke, and logs for authorization decisions. Keep UI language as Site Access / BrowserAgent Gateway, not AI Wallet.
- Reason: Wallet-like authorization is the core trust mechanism and is required before trusted websites can safely auto-run.
- Acceptance: `requestAccess` requires a user-understandable authorization path. Auto-run requires explicit consent. Revoked sites cannot call protected capabilities. Tests cover grant, deny, revoke, explicit auto-run consent, revoked rejection, and denied logs. `pnpm test` and `pnpm run build` pass.
- Result:
- Files:
- Verification:
- Review:
- Updated: 2026-05-02, Squad Lead

To: Barbatos | From: Squad Lead | Scope: `demo/` or `examples/`, `README.md`, optionally `vite.config.ts`
- Ref: e8b3d72
- Request: Build a minimal AIWeb demo that detects `window.browserAgent`, requests access, shows authorization status, calls `chat`, calls `run`, and displays error states. The demo should communicate that the app does not hold the user's API key and that capability is authorized through the browser extension.
- Reason: The demo will later show the practical value of decoupling AI Web apps from model/API-key custody without prematurely leading with AI Wallet terminology.
- Acceptance: Demo detects `window.browserAgent`, handles missing extension and authorization errors, calls `chat` and `run`, and includes README usage instructions. `pnpm test` and `pnpm run build` pass.
- Result:
- Files:
- Verification:
- Review:
- Updated: 2026-05-02, Squad Lead

## In Progress

No tasks claimed yet.

## Done

No tasks completed yet.
