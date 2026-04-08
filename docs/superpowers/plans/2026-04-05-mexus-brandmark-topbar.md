# Mexus Brandmark Topbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the topbar `Nexus` monitor logo treatment with a reusable SVG brand mark and `Mexus` wordmark.

**Architecture:** Add a dedicated `BrandMark` React component in the web component folder so the brand icon can be reused later without duplicating inline SVG markup. Update the topbar portion of `Layout.tsx` to consume that component and switch the displayed product label to `Mexus`, while leaving the empty-state monitor icon unchanged.

**Tech Stack:** React 18, TypeScript, Vite

---

### Task 1: Add the reusable brand icon component

**Files:**
- Create: `packages/web/src/components/BrandMark.tsx`
- Modify: `packages/web/src/components/Layout.tsx`

- [ ] **Step 1: Define the component boundary**

```tsx
type BrandMarkProps = {
  size?: number
}

export function BrandMark({ size = 18 }: BrandMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {/* stylized N path */}
    </svg>
  )
}
```

- [ ] **Step 2: Wire the component into the topbar**

```tsx
import { BrandMark } from './BrandMark'

<BrandMark size={18} />
<span>Mexus</span>
```

- [ ] **Step 3: Keep scope tight**

```tsx
// Do not replace the empty-state monitor icon in the "No agent panes" screen.
```

### Task 2: Verify the web bundle still builds

**Files:**
- Modify: `packages/web/src/components/BrandMark.tsx`
- Modify: `packages/web/src/components/Layout.tsx`

- [ ] **Step 1: Run the web build**

Run: `pnpm --filter @nexus/web build`
Expected: build succeeds with no TypeScript or Vite errors

- [ ] **Step 2: Check the final diff**

Run: `git diff -- packages/web/src/components/BrandMark.tsx packages/web/src/components/Layout.tsx`
Expected: diff only contains the new reusable brand mark and the topbar branding swap

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-04-05-mexus-brandmark-topbar.md packages/web/src/components/BrandMark.tsx packages/web/src/components/Layout.tsx
git commit -m "feat: rebrand topbar logo to Mexus"
```
