# Mexus Hub Local-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Hub into the main SPA entrypoint for local Mexus server CRUD and single-active-connection workspace tabs.

**Architecture:** Persist local instance records in the Hub registry, expose Hub-only APIs from the Hub server, and let the frontend choose a single active Mexus server target for workspace API and WebSocket traffic. Existing workspace UI remains reusable, but Hub owns tabs and connection state.

**Tech Stack:** Fastify, React, Zustand, Vitest, TypeScript

---

### Task 1: Lock registry semantics with tests

**Files:**
- Test: `packages/server/src/hub/InstanceRegistry.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
it('keeps a stopped record after markStoppedByPort', () => {
  register(...)
  markStoppedByPort(7700)
  expect(listInstances()[0]?.status).toBe('stopped')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @nexus/server test packages/server/src/hub/InstanceRegistry.test.ts`
Expected: FAIL because stopped records are currently pruned away.

- [ ] **Step 3: Implement registry status persistence**

```ts
export type InstanceStatus = 'running' | 'stopped'
```

- [ ] **Step 4: Re-run test**

Run: `pnpm --filter @nexus/server test packages/server/src/hub/InstanceRegistry.test.ts`
Expected: PASS

### Task 2: Expose Hub APIs for local CRUD

**Files:**
- Modify: `packages/server/src/hub/index.ts`
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: Add Hub mode API and local instance CRUD routes**
- [ ] **Step 2: Add permissive local CORS handling to workspace servers**
- [ ] **Step 3: Keep stopped records on shutdown instead of deregistering**
- [ ] **Step 4: Verify with targeted tests/build**

### Task 3: Introduce Hub SPA shell

**Files:**
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/hooks/useWebSocket.ts`
- Modify: `packages/web/src/lib/apiBase.ts`
- Modify: `packages/web/src/stores/workspaceStore.ts`
- Create: `packages/web/src/stores/connectionStore.ts`
- Create: `packages/web/src/stores/hubStore.ts`
- Create: `packages/web/src/components/HubApp.tsx`
- Create: `packages/web/src/components/HubDashboard.tsx`

- [ ] **Step 1: Add explicit connection target state**
- [ ] **Step 2: Render Hub shell in Hub mode**
- [ ] **Step 3: Make workspace API and WebSocket traffic follow the active target**
- [ ] **Step 4: Render disconnected state for stopped/unselected tabs**

### Task 4: Verify end-to-end behavior

**Files:**
- Modify as needed: touched files above

- [ ] **Step 1: Build the web app**
- [ ] **Step 2: Run targeted server tests**
- [ ] **Step 3: Run TypeScript verification**
- [ ] **Step 4: Fix any regressions**
