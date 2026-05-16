# Mexus File Tree Package Design

## Goal

Create an internal workspace package named `@mexus/file-tree` that isolates the `@pierre/trees` integration behind a stable Mexus API, validates the replacement for the current right-side file tree, and then integrates it into `@nexus/web`.

## Scope

The first version replaces the existing file tree behavior without adding a larger file-management workflow. It must support loading and empty states, rendering workspace files, opening files by path, highlighting the active file, exposing a collapse-all action to the existing header, and styling the tree to match the Mexus operator-console UI.

Git status, search, keyboard navigation, and prepared server input are valid follow-up improvements. The initial package should leave API room for Git status so the integration does not need another boundary change later.

## Architecture

Add `packages/file-tree` with package name `@mexus/file-tree`. The package owns all imports from `@pierre/trees`; `@nexus/web` consumes only Mexus-facing types and React components from `@mexus/file-tree`.

The package exports:

- `MexusFileTree`, a React component for rendering the tree.
- `flattenFileNodes`, a pure adapter from existing nested `FileNode[]` into canonical path rows.
- `deriveGitStatus`, a pure adapter from Mexus diff records into path-based Git status.
- `FileTreeActionHandle` and related types for imperative header actions.

`packages/web/src/components/FileTree.tsx` becomes a thin adapter from Zustand state to `MexusFileTree`.

## Data Flow

The server continues sending the existing `fs.tree` WebSocket payload. The web store keeps `FileNode[]` unchanged. The web file-tree wrapper passes the nested tree into `MexusFileTree`, which flattens it into path-first input for the underlying tree model.

Open file state remains owned by `@nexus/web` tabs. The wrapper passes `activePath`, `openPaths`, and `onOpenFile(path)`. The package does not import the web store.

## Error Handling

If the tree is not loaded, render the same loading state as today. If it is loaded but empty, render the same empty state. If `@pierre/trees` cannot support a specific header command in the first implementation, the package provides a deterministic fallback through its adapter state rather than leaking library internals to web.

## Testing

Use TDD for package behavior:

- `flattenFileNodes` preserves directory and file paths in stable display order.
- `deriveGitStatus` merges unstaged and staged diffs into path statuses.
- The web wrapper keeps the existing open-file contract by passing `onOpenFile` through package props.

Verification requires package tests, package typecheck, and the web build.

## Self-Review

No placeholders remain. The design is intentionally narrow: it creates the internal package, validates the third-party tree behind an adapter, and integrates the current file-tree use case. Future capabilities are named as follow-ups, not required for the first integration.
