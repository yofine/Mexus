# Mexus Hub Tab Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Hub server tab labels and persist open Hub tabs across browser reloads.

**Architecture:** Add a focused helper module for Hub tab persistence and display derivation. `HubApp.tsx` keeps owning UI state, but delegates localStorage parsing, save payload creation, and short path formatting to the helper.

**Tech Stack:** React, TypeScript, localStorage, Vitest, Vite build.

---

### Task 1: Hub Tab State Helpers

**Files:**
- Create: `packages/web/src/lib/hubTabs.ts`
- Create: `packages/web/src/lib/hubTabs.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import type { HubInstanceRecord } from '@/types'
import {
  buildHubTabSnapshot,
  createHubTab,
  formatShortPath,
  restoreHubTabs,
} from './hubTabs'

function instance(overrides: Partial<HubInstanceRecord> = {}): HubInstanceRecord {
  return {
    pid: 123,
    port: 7700,
    cwd: '/root/workspace/Mexus',
    projectName: 'Mexus',
    startedAt: 1,
    status: 'running',
    ...overrides,
  }
}

describe('hubTabs', () => {
  it('restores only tabs with matching server records', () => {
    const restored = restoreHubTabs({
      saved: {
        openServerIds: ['local:7700', 'local:7799'],
        activeTabId: 'tab:local:7799',
        connectedTabId: 'tab:local:7700',
        settingsTabOpen: false,
      },
      instances: [instance()],
      dashboardTabId: 'hub:dashboard',
      settingsTabId: 'hub:settings',
    })

    expect(restored.tabs).toEqual([createHubTab(instance())])
    expect(restored.activeTabId).toBe('hub:dashboard')
    expect(restored.connectedTabId).toBe('tab:local:7700')
  })

  it('does not restore a connected tab for a stopped server', () => {
    const restored = restoreHubTabs({
      saved: {
        openServerIds: ['local:7701'],
        activeTabId: 'tab:local:7701',
        connectedTabId: 'tab:local:7701',
        settingsTabOpen: false,
      },
      instances: [instance({ port: 7701, status: 'stopped' })],
      dashboardTabId: 'hub:dashboard',
      settingsTabId: 'hub:settings',
    })

    expect(restored.activeTabId).toBe('tab:local:7701')
    expect(restored.connectedTabId).toBeNull()
  })

  it('formats short cwd labels for tab tooltips and compact display', () => {
    expect(formatShortPath('/root/workspace/Mexus')).toBe('workspace/Mexus')
    expect(formatShortPath('/Mexus')).toBe('/Mexus')
  })

  it('builds snapshots from current instance data', () => {
    expect(buildHubTabSnapshot(instance())).toEqual({
      projectName: 'Mexus',
      port: 7700,
      cwd: '/root/workspace/Mexus',
      status: 'running',
      pid: 123,
    })
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm --filter @nexus/server exec vitest run --root ../.. packages/web/src/lib/hubTabs.test.ts`

Expected: FAIL because `packages/web/src/lib/hubTabs.ts` does not exist.

- [ ] **Step 3: Implement helpers**

Create `packages/web/src/lib/hubTabs.ts` with exported tab types, `serverIdFor`, `tabIdForServerId`, `createHubTab`, `formatShortPath`, `restoreHubTabs`, `safeLoadHubTabStorage`, and `saveHubTabStorage`.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm --filter @nexus/server exec vitest run --root ../.. packages/web/src/lib/hubTabs.test.ts`

Expected: PASS.

### Task 2: Wire HubApp UI And Persistence

**Files:**
- Modify: `packages/web/src/components/HubApp.tsx`

- [ ] **Step 1: Use helper state in HubApp**

Replace local tab type helpers with imports from `@/lib/hubTabs`.

- [ ] **Step 2: Restore persisted tabs after the first scanned instance refresh**

After `refresh(true)` returns instances, call `safeLoadHubTabStorage` and `restoreHubTabs` once.

- [ ] **Step 3: Persist tab state on changes**

When tabs, active tab, connected tab, or settings tab state changes after restore, call `saveHubTabStorage`.

- [ ] **Step 4: Improve tab display**

Render each server tab as status dot, project name, `:port`, short cwd label, and close icon. Add a title tooltip with project name, port, status, pid, and full cwd.

- [ ] **Step 5: Verify build**

Run: `pnpm --filter @nexus/web build`

Expected: TypeScript and Vite build complete successfully.
