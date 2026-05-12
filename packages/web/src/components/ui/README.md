# Mexus UI Kit

This directory contains the shared visual primitives for the Mexus web UI.

The kit is intentionally hard-edged and console-oriented: compact density, low radius, clear borders, subdued colors, and CSS variable driven theming.

## Rules

- Use these primitives before adding page-local button, badge, tab, toolbar, empty, loading, or error styles.
- Keep behavior in feature components. UI kit components should stay mostly presentational.
- Do not use these components to introduce new product concepts. They should render existing data and actions.
- Use `pane color` for pane instance ownership. Use `agent type` icons for agent identity. Do not mix the two concepts.
- Prefer compact composition: rows, panels, tabs, toolbars, and small badges over large decorative cards.
- Keep old business components in place until a replacement phase explicitly switches them over.

## Exports

Import from the local barrel:

```tsx
import { IconButton, PanelHeader, Badge } from '@/components/ui'
```

## Base Primitives

- `Button`
- `IconButton`
- `Input`
- `Select`
- `Label`
- `Card`
- `Badge`
- `StatusDot`
- `Tooltip`

## Layout And Shells

- `PanelHeader`
- `SectionHeader`
- `Toolbar`
- `ToolbarGroup`
- `TabList`
- `TabButton`
- `DialogShell`
- `ConfirmDialog`

## Feedback And States

- `EmptyState`
- `LoadingState`
- `ErrorBanner`
- `InlineNotice`

## Forms And Filters

- `Field`
- `FormRow`
- `SearchInput`
- `SegmentedControl`

## Metadata And Identity

- `AgentIdentity`
- `MetaRow`
- `KeyValueMeta`

## Product Primitives

These are still presentational. They encode layout and visual language, not business behavior.

- `PaneCard`
- `PaneStackRow`
- `MissionAgentRow`
- `TaskCard`
- `HubInstanceCard`
- `HubInstanceRow`
- `CommandGroup`
- `CommandItem`
- `TreeContainer`
- `TreeNodeRow`

## Verification

Run:

```bash
pnpm exec vitest run --config packages/web/vite.config.ts packages/web/src/components/ui/ui-kit.test.tsx packages/web/src/components/ui/ui-kit-extended.test.tsx
pnpm --filter @nexus/web build
```
