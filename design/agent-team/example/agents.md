# Agent Roster

This file is the repository-level roster of reusable agents.

It is not a mission assignment file. Mission-specific squads live in:

```text
agent-team/missions/<mission-name>/agents.md
```

Use this roster when starting a new Mission to decide whether an existing agent should be reused based on module ownership, work history, and demonstrated context.

## Usage Rules

- Keep agent names stable across Missions.
- Agent names are communication handles chosen from the Ars Goetia / Lesser Key of Solomon name set.
- Agent names must not encode current tasks.
- Add a new agent only when no existing agent has a close module history or responsibility fit.
- Update `Work History` after a Mission assigns meaningful work to the agent.
- Do not put mission-specific activation prompts here; those belong in the mission's `agents.md`.

## Agent Profile Format

```md
## AgentName

Primary modules:
- `path/or/module`

Known strengths:
- <Reusable capability>

Work history:
- <YYYY-MM-DD> | `<mission-name>` | <role or workstream> | <status/result>

Notes:
- <Long-term coordination note>
```

## Bael

Primary modules:
- `src/shared/types.ts`
- `src/injected/browserAgent.ts`
- `src/content/index.ts`
- `src/background/index.ts`
- `src/shared/permissions.ts`
- `README.md`

Known strengths:
- BrowserAgent Gateway protocol design.
- Page-to-extension message bridge.
- Request/response/error shape and gateway examples.
- Permission scope surface for web-exposed APIs.

Work history:
- 2026-05-02 | `2026-05-02-browser-agent-wallet-mvp` | BrowserAgent gateway protocol | Assigned initial v1 gateway protocol work.
- 2026-05-02 | `2026-05-02-haro-sidepanel-streaming` | Sidepanel/background streaming protocol | Assigned streaming transport and fallback compatibility work.

Notes:
- Reuse Bael for future Missions that touch `window.browserAgent`, web-facing gateway contracts, content/injected bridge behavior, or protocol documentation.

## Agares

Primary modules:
- `src/model-gateway/`
- `src/shared/storage.ts`
- `src/shared/types.ts`
- `src/options/App.tsx`
- `src/options/styles.css`

Known strengths:
- Model provider configuration.
- OpenAI-compatible and Anthropic-compatible gateway behavior.
- Provider profile storage, defaults, and secret-handling boundaries.
- Options UI for model setup.

Work history:
- 2026-05-02 | `2026-05-02-browser-agent-wallet-mvp` | Model gateway and options provider setup | Assigned initial provider configuration work.
- 2026-05-02 | `2026-05-02-haro-sidepanel-streaming` | Provider streaming capability and fallback behavior | Assigned model gateway streaming and explicit fallback work.

Notes:
- Reuse Agares for future Missions involving model routing, provider profiles, model selection, API-key storage boundaries, or options-page model settings.

## Vassago

Primary modules:
- `src/sidepanel/App.tsx`
- `src/sidepanel/styles.css`
- `src/shared/i18n.ts`
- `src/shared/types.ts`

Known strengths:
- Sidepanel product experience.
- AI Browser control surface design.
- Timeline, composer, status, and permission state presentation.
- Compact user-facing UI for browser-agent workflows.

Work history:
- 2026-05-02 | `2026-05-02-browser-agent-wallet-mvp` | Sidepanel AI Browser control surface | Assigned initial sidepanel upgrade work.
- 2026-05-02 | `2026-05-02-haro-sidepanel-streaming` | Sidepanel streaming conversation UI | Assigned Haro pending reply, assistant delta merge, timeline streaming, and fallback UI work.

Notes:
- Reuse Vassago for future Missions that touch sidepanel interaction design, Agent event rendering, browser-control UX, or user-facing AI Browser framing.

## Samigina

Primary modules:
- `src/shared/callLogs.ts`
- `src/shared/debugLogs.ts`
- `src/shared/types.ts`
- `src/options/App.tsx`
- `src/options/styles.css`
- `src/background/index.ts`

Known strengths:
- Call history and debug log design.
- Redaction and sensitive-data safety.
- Observability for gateway, site access, model calls, and browser actions.
- Options-page log inspection.

Work history:
- 2026-05-02 | `2026-05-02-browser-agent-wallet-mvp` | Call history, debug logs, and redaction | Assigned initial observability and log-safety work.
- 2026-05-02 | `2026-05-02-haro-sidepanel-streaming` | Streaming safety, logs, and regression coverage | Assigned stream event redaction, fallback/error observability, and memory persistence safety work.

Notes:
- Reuse Samigina for future Missions involving audit trails, privacy-preserving logs, debug visibility, or user trust surfaces.

## Marbas

Primary modules:
- `src/agent/runtime.ts`
- `src/agent/runtime.test.ts`
- `src/shared/types.ts`
- `src/background/index.ts`

Known strengths:
- Browser Agent runtime loop.
- Observe-act-final protocol.
- Conservative action selection and runtime event emission.
- Agent behavior tests and bounded execution.

Work history:
- 2026-05-02 | `2026-05-02-browser-agent-wallet-mvp` | Bounded Browser Agent runtime | Assigned initial pi-mono-inspired observe-act loop work.
- 2026-05-02 | `2026-05-02-haro-sidepanel-streaming` | Runtime progressive event emission | Assigned safe streaming event hooks for chat and run flows.

Notes:
- Reuse Marbas for future Missions involving Agent runtime behavior, action protocols, step limits, runtime safety, or Agent event schemas.

## Valefor

Primary modules:
- `src/background/debuggerTools.ts`
- `src/background/index.ts`
- `src/shared/types.ts`
- `src/shared/permissions.ts`
- `src/agent/runtime.ts`

Known strengths:
- Chrome Debugger API tool layer.
- Gated browser-control capability.
- Active-tab-only constraints.
- Attach/detach lifecycle and debugger failure logging.

Work history:
- 2026-05-02 | `2026-05-02-browser-agent-wallet-mvp` | Chrome Debugger API tool layer | Assigned initial gated debugger tools work.

Notes:
- Reuse Valefor for future Missions involving debugger control, advanced page inspection, browser action execution, or active-tab safety boundaries.

## Amon

Primary modules:
- `src/shared/permissions.ts`
- `src/background/index.ts`
- `src/options/App.tsx`
- `src/options/styles.css`
- `src/shared/types.ts`
- `src/shared/callLogs.ts`

Known strengths:
- Site Access authorization flow.
- Allow, deny, revoke, and explicit auto-run consent.
- User-understandable risk text and authorization logging.
- Wallet-like trust mechanics without exposing AI Wallet product language too early.

Work history:
- 2026-05-02 | `2026-05-02-browser-agent-wallet-mvp` | Site Access authorization flow | Assigned initial site authorization work.

Notes:
- Reuse Amon for future Missions involving site permissions, authorization UX, trusted origins, auto-run policy, or revocation behavior.

## Barbatos

Primary modules:
- `demo/`
- `examples/`
- `README.md`
- `vite.config.ts`

Known strengths:
- AIWeb gateway demo applications.
- Web app integration with `window.browserAgent`.
- Missing-extension, unauthorized, and model-not-configured demo states.
- Documentation for capability decoupling and API-key custody boundaries.

Work history:
- 2026-05-02 | `2026-05-02-browser-agent-wallet-mvp` | AIWeb gateway demo | Assigned initial demo app work.

Notes:
- Reuse Barbatos for future Missions involving external AIWeb examples, demo apps, integration guides, or adoption-facing documentation.
