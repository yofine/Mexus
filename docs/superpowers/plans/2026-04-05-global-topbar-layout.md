# Global Topbar Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single global top navigation bar that contains the Mexus brand, and remove the local agent-panel brand header.

**Architecture:** Keep the existing three-panel workspace layout intact, but wrap it in a root column layout with a dedicated top navigation row. Reuse the new `BrandMark` component in the global topbar, move the connection status indicator there, and let the agent column start directly with pane content.

**Tech Stack:** React 18, TypeScript, Vite

---

### Task 1: Introduce the topbar shell and move branding there

**Files:**
- Modify: `packages/web/src/components/Layout.tsx`
- Modify: `packages/web/src/components/BrandMark.tsx`

- [ ] **Step 1: Restructure the root layout**

```tsx
return (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
    <div>{/* global topbar */}</div>
    <div>{/* existing main content row */}</div>
  </div>
)
```

- [ ] **Step 2: Place brand and status in the topbar**

```tsx
<BrandMark size={20} />
<span>{name || 'Mexus'}</span>
<div title={connectionStatus} />
```

- [ ] **Step 3: Remove the old local brand header**

```tsx
// Delete the agents-column header row that currently shows BrandMark + Mexus + connection dot.
```

### Task 2: Verify the web bundle still builds

**Files:**
- Modify: `packages/web/src/components/Layout.tsx`
- Modify: `packages/web/src/components/BrandMark.tsx`

- [ ] **Step 1: Run the web build**

Run: `pnpm --filter @nexus/web build`
Expected: build succeeds with no TypeScript or Vite errors

- [ ] **Step 2: Review the focused diff**

Run: `git diff -- packages/web/src/components/Layout.tsx packages/web/src/components/BrandMark.tsx docs/superpowers/plans/2026-04-05-global-topbar-layout.md`
Expected: diff only contains the topbar shell and brand placement changes

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-04-05-global-topbar-layout.md packages/web/src/components/BrandMark.tsx packages/web/src/components/Layout.tsx
git commit -m "feat: move Mexus branding into global topbar"
```
