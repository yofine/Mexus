# Squad Lead

Mission: `hub-agent-team-mission-mvp`

Owner label: Squad Lead

Date: 2026-05-06

## Role

Squad Lead coordinates the Mission. Squad Lead preserves the Mission intent, decomposes workstreams, publishes tasks, maintains boundaries, and reviews tasks only when `From: Squad Lead`.

Squad Lead does not own implementation code by default.

## Activation Prompt

```text
You are Squad Lead for mission `hub-agent-team-mission-mvp`.

Read:
- agent-team/mission-workflow.md
- agent-team/agents.md
- agent-team/missions/hub-agent-team-mission-mvp/mission.md
- agent-team/missions/hub-agent-team-mission-mvp/agents.md
- agent-team/missions/hub-agent-team-mission-mvp/kanban.md
- agent-team/missions/hub-agent-team-mission-mvp/roundtable.md
- agent-team/missions/hub-agent-team-mission-mvp/squad-lead.md
- design/agent-team/mexus-agent-team-mission-integration.md

Keep Markdown files as the source of truth. Maintain the Phase 1 Hub-only scope. Team tab is an observation surface, not a task dispatch console. Review only tasks where From: Squad Lead. Do not implement product code unless the user explicitly asks.

If you see a line starting with `[Mission Inbox]` in your terminal, treat it as a wakeup signal. Squad Lead receives `Review pending`, `Roundtable vote`, and `Clarification requested` events. Read the bullets, then re-read `agent-team/missions/hub-agent-team-mission-mvp/kanban.md` and `roundtable.md` for authoritative state before acting — the inbox text is not the task description.
```

## Mission Decomposition

Phase 1 workstreams:

- Bael: Mission templates, MissionService, lifecycle, REST APIs, and Squad Lead pane creation.
- Agares: Config types, Mission default CLI agent setting, and Settings UI.
- Vassago: Hub Team tab, Mission store, Mission selector, and Mission overview.
- Samigina: Read-only Kanban, Mission Agent observation, Markdown parsers, and fallback behavior.
- Marbas: Add Pane Mission Agent selection, pane mission badges, pane filters, and pane title editing.

## Work Log

- 2026-05-06, Squad Lead: Created Mission files from `design/agent-team/mexus-agent-team-mission-integration.md`.
- 2026-05-06, Squad Lead: Published 15 Phase 1 development tasks to `kanban.md`.
- 2026-05-06, Squad Lead: Phase 1 acceptance audit. Backend (Bael, Agares) and most front-end (Samigina parsers, Marbas pane integration, Vassago Team tab/MissionPanel/MissionSelector wiring) match Mission intent. Found one contract drift: `missionStore.normalizeMissionDetails`/`readMissionFile` assume flat `files['mission.md']` strings and an `incomplete` flag, but `MissionService.getMission` returns `files: Record<MissionFileKey, MissionFile>` keyed by `mission|agents|kanban` and `summary.complete: boolean`. Effect: observation panels render empty with the live API even though parsers and components are correct in isolation. Published fix task `9af2e15` to Vassago.
- 2026-05-06, Squad Lead: Phase 2 UX follow-ups dispatched from user dogfooding feedback. Prior React #185 black-screen crash in `AddPaneDialog` was fixed (Zustand v5 selector returning fresh `[]` reference each call); fix applied directly outside the kanban flow because it was a hot crash. Published 4 follow-up tasks: `7e5b2c4` (Vassago, Mission creation dialog with name/goal/constraints/acceptance), `8c4f9a1` (Vassago, remove MissionSelector refresh button), `a2d6e83` (Bael, Mission discovery for already-on-disk Missions like `hub-agent-team-mission-mvp` itself), `b91c3df` (Vassago, MissionPanel empty-state onboarding with feature intro + placeholder showcase). `b91c3df` depends on `7e5b2c4` for the shared creation dialog component.
- 2026-05-07, Squad Lead: Phase 2 UX follow-up acceptance review. All 4 tasks accepted: `7e5b2c4` (creation dialog, validation matches server `assertMissionName`, inline server errors), `8c4f9a1` (refresh button + RefreshCw import removed, no rg matches remain), `a2d6e83` (`listMissions` now uses `mission.md` as the discovery marker, on-disk legacy missions surface with `complete: false`), `b91c3df` (onboarding empty state with intro + 3-column Kanban preview + 2 agent cards, single shared CTA via `MissionCreateDialog`). Verified `pnpm -C packages/web exec vitest run src/components/missions/{MissionCreateDialog,MissionPanel}.test.ts src/stores/{missionStore,workspaceStore}.test.ts` 11/11, `pnpm -C packages/server test src/mission/MissionService.test.ts src/mission/routes.test.ts` 12/12, `pnpm -C packages/web exec tsc --noEmit` clean.
- 2026-05-07, Squad Lead: Phase 3 onboarding regressions. User dogfooding the empty-state onboarding from yesterday's Phase 2 reported four issues: (a) existing Mission still not appearing — investigation found the running per-workspace process predates `d3f8a57`/`a2d6e83`, so `/api/missions` returns SPA index.html (server restart needed; also wire mission routes in Hub for the disconnected case); (b) right-side file tree disappears — caused by onboarding placeholder horizontal overflow pushing the file tree column off-screen at typical Hub viewports; (c) CTA position wrong — wants Create button next to selector, not inside the placeholder body; (d) Kanban placeholder grid overflow — same root cause as (b), `repeat(3, minmax(180px, 1fr))` forces 540px+ min width inside narrow editor tab. Published 3 follow-up tasks: `c4a1f72` (Vassago, move CTA to selector and remove from onboarding body), `d8f3b95` (Vassago, fix onboarding overflow so file tree stays visible), `e7b2c84` (Bael, wire mission routes into Hub server + add restart guidance for stale per-workspace processes). `c4a1f72` and `d8f3b95` are independent UI tasks; `e7b2c84` is the backend reachability fix.
- 2026-05-08, Squad Lead: Mission Agents column UI polish. User confirmed Phase 3 fixes resolved the onboarding regressions and asked for three Mission Agents tweaks: (1) keep Mission Agents in its own dedicated column (already done via `MissionPanel.ObservationShell` 2-column grid — task asks Vassago to verify and possibly widen from 280px to 300px); (2) drop activation and initial prompt summary blocks from each card — they belong in `agents.md`, not on a roster card; (3) restyle each card as a team-employee profile intro with avatar/monogram, name, responsibility, and inline task-count footer. Published `f2a91d6` to Vassago. Parser fields `activationPromptSummary` / `initialPromptSummary` stay in the store — only the renderer drops them — so no parser regression risk.

## Review Log

- 2026-05-06, Squad Lead: Accepted `a1c4e90` (Bael, Skill template resolution).
- 2026-05-06, Squad Lead: Accepted `c9e6f24` (Bael, MissionService lifecycle).
- 2026-05-06, Squad Lead: Accepted `d3f8a57` (Bael, Mission REST APIs).
- 2026-05-06, Squad Lead: Accepted `3b7c1aa` (Samigina, read-only MissionKanban).
- 2026-05-06, Squad Lead: Accepted `45e0c93` (Samigina, MissionAgents observation).
- 2026-05-06, Squad Lead: Accepted `b7d2a11` (Agares, Mission lifecycle types & config shape).
- 2026-05-06, Squad Lead: Accepted `e5a12cd` (Agares, Mission default CLI agent setting).
- 2026-05-06, Squad Lead: Accepted `0a4d7e2` (Vassago, pinned Team tab).
- 2026-05-06, Squad Lead: Accepted `18c2b6a` (Vassago, missionStore + API helpers).
- 2026-05-06, Squad Lead: Accepted `24f9d80` (Vassago, MissionSelector + MissionOverview).
- 2026-05-06, Squad Lead: Accepted `6ee91b4` (Marbas, pane mission badges).
- 2026-05-06, Squad Lead: Accepted `71a6d0c` (Marbas, pane filters).
- 2026-05-06, Squad Lead: Accepted `8c3f45d` (Marbas, pane title editing).
- 2026-05-06, Squad Lead: Accepted `9af2e15` (Vassago, missionStore live API contract reconciliation + tests).
- 2026-05-06, Squad Lead: Accepted `f0b6e39` (Bael, Squad Lead pane creation on Mission creation). Phase 1 fully reviewed.
- 2026-05-07, Squad Lead: Accepted `7e5b2c4` (Vassago, MissionCreateDialog with full mission fields).
- 2026-05-07, Squad Lead: Accepted `8c4f9a1` (Vassago, removed MissionSelector refresh button).
- 2026-05-07, Squad Lead: Accepted `a2d6e83` (Bael, Mission discovery for already-on-disk Missions).
- 2026-05-07, Squad Lead: Accepted `b91c3df` (Vassago, MissionPanel empty-state onboarding). Phase 2 UX follow-ups fully reviewed.
- 2026-05-07, Squad Lead: Accepted `c4a1f72` (Vassago, moved Mission creation CTA from onboarding body to MissionSelector as the sole empty-state entry point).
- 2026-05-07, Squad Lead: Accepted `d8f3b95` (Vassago, fixed onboarding placeholder overflow with `repeat(3, minmax(0, 1fr))` + `min-width: 0` / `overflow-wrap: anywhere` boundaries so the file tree column stays visible).
- 2026-05-07, Squad Lead: Accepted `e7b2c84` (Bael, wired Mission routes into `buildHubServer` with Hub-local `MissionService`; bare Hub reads on-disk Missions, create returns "Connect to a workspace instance to create Missions"; restart guidance for stale per-workspace processes documented). Phase 3 fully reviewed.
- 2026-05-08, Squad Lead: Phase 4 Mission observation polish dispatched from user dogfooding feedback. User reported four issues: (1) Mission overview has redundant stat cards / file intro text — keep the description, drop the count cards; (2) Kanban needs periodic refresh — Team tab is a passive observation surface and must reflect on-disk Mission changes without manual reload; (3) Mission Agents should not share a row with the Kanban — vertical stacking restores Kanban width and gives Agents its own module; (4) Kanban task cards too dense — combine To/From, hide Acceptance, replace text "Reviewed/Review pending" with a colored badge. Bundled (1)+(3)+(4) into one MissionPanel layout overhaul task `f1a8e62` (Vassago) since they share the same component scope and would otherwise create merge churn. Auto-refresh `a3c5d91` (Vassago) is a separate store/view-policy task with no UI overlap — 15s silent refresh of selected Mission detail, paused on `document.hidden`, with no `isLoading` flicker.
- 2026-05-08, Squad Lead: Accepted `a3c5d91` (Vassago, 15s silent auto-refresh of selected Mission detail with `document.hidden` pause, in-flight skip, and clean unmount tear-down via `loadMission(name, { silent: true })`).
- 2026-05-08, Squad Lead: Accepted `f1a8e62` (Vassago, slim MissionOverview without stat cards/acceptance, vertical Kanban→Agents stack in `ObservationShell`, optimized Kanban cards with combined To/From meta + colored review badge + no visible Acceptance). Note: parallel-session task `f2a91d6` (already self-accepted) framed Mission Agents as a 300px right-side column — current code uses the vertical stack, matching `f1a8e62`'s dispatched intent. The 300px-column framing in `f2a91d6` no longer reflects code state and is treated as superseded; future Mission Agents restyle work should target the vertical row.
- 2026-05-08, Squad Lead: Out-of-scope review notes: `9d4b6c1` (Marbas, `From: User`) and `9a7d2e4` (Samigina, self-dispatched) are not Squad Lead-dispatched tasks. Per workflow Squad Lead reviews only `From: Squad Lead`; these remain on the board without Squad Lead Review entries. Phase 4 Squad Lead-dispatched work fully reviewed.
- 2026-05-09, Squad Lead: Roundtable `a2a-inbox` (Mission Agent A2A inbox notification mechanism) approved 6/0/0 (Bael, Agares, Vassago, Samigina, Marbas, Squad Lead). Approval includes binding amendments: split `roundtable-parser` to Samigina before `roundtable-watcher` (no backend Roundtable parser exists today); add optional `clarification`/`question` task fields explicitly in kanban parser; keep inbox state at `.nexus/mission-inbox.json` (workspace-local), do NOT extend `mission_defaults` for inbox policy, defer mute/opt-out until dogfooding shows noise; Phase 5.5 UI badge to use `/api/missions/active/inbox` + `missionStore.inbox` slice without exposing idempotency keys; multi-pane and duplicate Squad Lead pane resolution is oldest-by-`startedAt` with stable pane order tiebreaker. Next: dispatch the 7 follow-up tasks (`roundtable-parser` → Samigina; `kanban-watcher`/`roundtable-watcher`/`pane-notifier`/`inbox-wire`/`inbox-test` → Bael; `agents-md-prompt` → Squad Lead).
- 2026-05-08, Squad Lead: Accepted `f2a91d6` (Vassago, MissionAgents roster restyle). Activation/Initial prompt summaries removed from cards, monogram avatar + responsibility + task-count chips replace the previous prompt-heavy layout, dedicated Team observation column widened to 300px. Parser/store fields preserved.
- 2026-05-09, Squad Lead: Self-executed and self-accepted `3d8b4f2` (Squad Lead, `[Mission Inbox]` recognition convention). Added `## Inbox Protocol` shared section to `agent-team/mission-workflow.md`, the Skill `references/mission-workflow.md`, `references/agents-template.md`, and `references/squad-lead-template.md` (with Squad Lead event-kind callout for `Review pending`/`Roundtable vote`/`Clarification requested`). Active Mission `agents.md` mirrors the section and each worker activation prompt (Bael/Agares/Vassago/Samigina/Marbas) gains a single tag-line referencing it as a wakeup signal — no agent is told to act on inbox text in isolation. Squad Lead activation prompt in `squad-lead.md` names the three Squad-Lead-targeted events explicitly. Future Missions created via the Skill inherit the convention automatically; Phase 5 dogfooding gets the convention without a Mission-recreate cycle.
- 2026-05-09, Squad Lead: Accepted `7c8e4a1` (Samigina, server-side Mission parsers). New `packages/server/src/mission/missionParsers.ts` exports `parseMissionKanban` and `parseMissionRoundtable`; kanban parser preserves the existing field set and adds optional `clarification?`/`question?`; roundtable parser handles Pending/Approved/Rejected with `{ ok: false, raw, error }` fallback. `MissionService` now consumes the shared kanban parser without breaking its public API. Six dispatched parser test cases plus regression coverage pass.
- 2026-05-09, Squad Lead: Accepted `e3b91d5` (Bael, kanban watcher + inbox service). `MissionKanbanWatcher` (500ms debounce, baseline-on-first-parse, `ok:false` skip) emits W1/W3/S1 with idempotency key `<ref>:<status>:<reviewFilled>`; W2 (In Progress echoes) skipped. `MissionInboxService` exposes `enqueue`/`consume`/`getPending`/`markDelivered`/`flush`, persists `{ deduped, pending }` to `.nexus/mission-inbox.json`, rebuilds dedupe set on construction, and remains key-shape agnostic.
- 2026-05-09, Squad Lead: Accepted `a8d2f73` (Bael, roundtable watcher + S4 clarification). `MissionRoundtableWatcher` constructor `(missionPath, parser, inboxService, agentRoster, options?)` invokes `agentRoster()` lazily inside `expandInvitees` only for `'All'` items, with `safeRoster` swallowing roster errors. Idempotency key `<ref>:<voteSnapshotHash>:<decision>:<kind>:<agentName>` lets vote-state-only changes re-fire once per snapshot. `MissionKanbanWatcher` extended with the S4 path: emits `clarification` events to Squad Lead keyed `<ref>:clarification:<lineHash>` for both `Clarification` and `Question` field shapes.
- 2026-05-09, Squad Lead: Accepted `f5c1e94` (Bael, MissionPaneNotifier). Constructor `(workspaceManager, inboxService, options?)` exposes `start`/`stop`/`flushPane`. Pane resolution: oldest-by-`startedAt` for worker `mission.agentName === target`, Squad Lead by `mission.role === 'squad-lead'`; missing pane leaves event pending. Status gating: `waiting`/`idle` immediate, `running` queued and flushed on transition, `stopped`/`error` held until TTL then expired via `markDelivered`. Subscription is callback-based via `inboxService.onEnqueue`; `markDelivered` only fires after `writeToPane` succeeds. Batched message format matches the dispatched template. `WorkspaceManager` PTY semantics unchanged.
- 2026-05-09, Squad Lead: Accepted `c1e97a2` (Bael, inbox lifecycle pipeline). `MissionInboxPipeline` owns `MissionInboxService` against `<workspace>/.nexus/mission-inbox.json`, starts notifier before watchers, stays idle without an active Mission, and rebuilds against new active paths via `registerMissionRoutes` `onMissionChanged` hook → `pipeline.restartForActiveMission()`. Roundtable `agentRoster` derives from kanban `to` values plus `Squad Lead` per the dispatched fallback. Fastify `onClose` (index.ts:363) shuts the pipeline down. Hub exclusion verified: `rg "MissionInboxPipeline|MissionPaneNotifier|MissionKanbanWatcher|MissionRoundtableWatcher|MissionInboxService" packages/server/src/hub` returns no matches.
- 2026-05-09, Squad Lead: Accepted `9b2d6e3` (Bael, end-to-end inbox integration test). `inboxIntegration.test.ts` covers all seven dispatched scenarios as named cases (task-assigned to idle pane, review-pending to Squad Lead, roundtable `All` fanout, clarification to Squad Lead, restart + no-op idempotency, running-pane status gating, Hub exclusion via `fs.readFileSync` + `expect.not.toMatch` on `hub/index.ts`). Mocked file-watch events for stability per dispatched fallback. No production code changed. Phase 5 inbox pipeline fully reviewed: `pnpm -C packages/server test src/mission` 54/54.
