# Mexus File Tree Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@mexus/file-tree` as an internal adapter package around `@pierre/trees` and integrate it into the existing web file-tree panel.

**Architecture:** `packages/file-tree` owns all third-party tree integration and exports a stable Mexus component plus pure data adapters. `packages/web/src/components/FileTree.tsx` remains the Zustand-aware wrapper and delegates rendering to `@mexus/file-tree`.

**Tech Stack:** TypeScript, React 18, Vitest, pnpm workspace, `@pierre/trees`.

---

## File Structure

- Create `packages/file-tree/package.json`: internal package manifest with `test` and `typecheck` scripts.
- Create `packages/file-tree/tsconfig.json`: package TypeScript config.
- Create `packages/file-tree/vitest.config.ts`: package test config for pure adapter tests.
- Create `packages/file-tree/src/types.ts`: Mexus-facing file tree and diff types.
- Create `packages/file-tree/src/adapters.ts`: pure `flattenFileNodes` and `deriveGitStatus` functions.
- Create `packages/file-tree/src/MexusFileTree.tsx`: React component wrapping `@pierre/trees`.
- Create `packages/file-tree/src/index.ts`: public exports.
- Create `packages/file-tree/src/adapters.test.ts`: TDD coverage for pure adapters.
- Modify `packages/web/package.json`: depend on `@mexus/file-tree`.
- Modify `packages/web/src/components/FileTree.tsx`: thin wrapper around `MexusFileTree`.

### Task 1: Package Scaffold And Pure Adapters

**Files:**
- Create: `packages/file-tree/package.json`
- Create: `packages/file-tree/tsconfig.json`
- Create: `packages/file-tree/vitest.config.ts`
- Create: `packages/file-tree/src/types.ts`
- Create: `packages/file-tree/src/adapters.test.ts`
- Create: `packages/file-tree/src/adapters.ts`
- Create: `packages/file-tree/src/index.ts`

- [ ] **Step 1: Write failing adapter tests**

Create `packages/file-tree/src/adapters.test.ts` with tests for flattened paths and Git status precedence.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mexus/file-tree test`
Expected: failure before adapter implementation is present.

- [ ] **Step 3: Add package config and adapter implementation**

Add the package manifest, TypeScript config, Vitest config, types, pure adapters, and exports.

- [ ] **Step 4: Run package tests**

Run: `pnpm --filter @mexus/file-tree test`
Expected: adapter tests pass.

### Task 2: React Tree Component

**Files:**
- Create: `packages/file-tree/src/MexusFileTree.tsx`
- Modify: `packages/file-tree/src/index.ts`
- Modify: `packages/file-tree/src/types.ts`

- [ ] **Step 1: Add component types**

Define `MexusFileTreeProps` and `FileTreeActionHandle` without importing web store types.

- [ ] **Step 2: Implement `MexusFileTree`**

Wrap `@pierre/trees/react`, update the model from `FileNode[]` changes, and preserve loading, empty, open-file, active-file, and collapse-all behavior.

- [ ] **Step 3: Typecheck package**

Run: `pnpm --filter @mexus/file-tree typecheck`
Expected: TypeScript exits 0.

### Task 3: Web Integration

**Files:**
- Modify: `packages/web/package.json`
- Modify: `packages/web/src/components/FileTree.tsx`

- [ ] **Step 1: Add workspace dependency**

Add `"@mexus/file-tree": "workspace:*"` to `packages/web/package.json`.

- [ ] **Step 2: Replace recursive file-tree rendering**

Update `packages/web/src/components/FileTree.tsx` to read Zustand state and render `MexusFileTree`.

- [ ] **Step 3: Build web**

Run: `pnpm --filter @nexus/web build`
Expected: TypeScript and Vite build exit 0.

### Task 4: Final Verification

**Files:**
- Check all changed files related to `@mexus/file-tree` and web integration.

- [ ] **Step 1: Run package tests**

Run: `pnpm --filter @mexus/file-tree test`
Expected: pass.

- [ ] **Step 2: Run package typecheck**

Run: `pnpm --filter @mexus/file-tree typecheck`
Expected: pass.

- [ ] **Step 3: Run web build**

Run: `pnpm --filter @nexus/web build`
Expected: pass.

## Self-Review

The plan covers the spec requirements: internal package, stable exports, pure adapters, React component, web wrapper integration, and verification. There are no placeholder steps; follow-up features remain outside this first implementation.
