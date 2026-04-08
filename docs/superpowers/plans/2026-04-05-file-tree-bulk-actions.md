# File Tree Bulk Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add practical bulk controls to the right file tree header: expand all, collapse all, and collapse to first level.

**Architecture:** Keep file-tree expansion state local to the file tree feature, but extract expansion-set builders into focused helpers so header actions stay simple and reusable. The header remains in `Layout.tsx`, while `FileTree.tsx` exposes callback props for the three bulk actions and still owns the actual expanded state.

**Tech Stack:** React 18, TypeScript, Vite

---

### Task 1: Extract reusable tree expansion helpers

**Files:**
- Modify: `packages/web/src/components/FileTree.tsx`

- [ ] **Step 1: Add pure helpers**

```ts
function collectExpandablePaths(nodes: FileNode[]): Set<string> {
  const expanded = new Set<string>()
  // recursively add every directory path
  return expanded
}

function collectFirstLevelPaths(nodes: FileNode[]): Set<string> {
  const expanded = new Set<string>()
  // add only root-level directories
  return expanded
}
```

- [ ] **Step 2: Keep initial two-level auto-expand behavior intact**

```ts
// do not replace the existing first-load auto-expand behavior
```

### Task 2: Add header actions and wire them into FileTree

**Files:**
- Modify: `packages/web/src/components/Layout.tsx`
- Modify: `packages/web/src/components/FileTree.tsx`

- [ ] **Step 1: Add three lightweight header buttons**

```tsx
title="Expand all"
title="Collapse to top level"
title="Collapse all"
```

- [ ] **Step 2: Wire them to FileTree callbacks**

```tsx
<FileTree
  actions={set => ...}
/>
```

- [ ] **Step 3: Implement the three actions in FileTree**

```ts
setExpanded(collectExpandablePaths(fileTree))
setExpanded(collectFirstLevelPaths(fileTree))
setExpanded(new Set())
```

### Task 3: Verify the web bundle still builds

**Files:**
- Modify: `packages/web/src/components/Layout.tsx`
- Modify: `packages/web/src/components/FileTree.tsx`

- [ ] **Step 1: Run the web build**

Run: `pnpm --filter @nexus/web build`
Expected: build succeeds with no TypeScript or Vite errors

- [ ] **Step 2: Review focused diff**

Run: `git diff -- packages/web/src/components/Layout.tsx packages/web/src/components/FileTree.tsx docs/superpowers/plans/2026-04-05-file-tree-bulk-actions.md`
Expected: diff contains only the new file-tree header actions and expansion helpers

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-04-05-file-tree-bulk-actions.md packages/web/src/components/Layout.tsx packages/web/src/components/FileTree.tsx
git commit -m "feat: add file tree bulk expand controls"
```
