# Mexus Mobile Workspace Layout Design

## Background

Mexus desktop workspace is built around three persistent work areas:

- Left: Pane stack for Agent communication and terminal control.
- Middle: `EditorTabs` for Activity, Team, Review, Replay, file previews, and diffs.
- Right: file tree for project navigation.

This works on desktop because the user can scan all three areas at once. On a phone,
the same structure becomes too dense. The mobile experience should focus on talking to
Agents through Panes, while still keeping Editor and Files reachable without creating
a separate mobile-only product.

The goal is a responsive workspace shell that uses the same React components, store,
WebSocket protocol, terminal registry, and UI kit as desktop.

## Goals

- Support phone-sized viewports with one primary screen visible at a time.
- Keep Agent Pane communication as the default and highest-priority mobile workflow.
- Reuse the existing `Layout`, `AgentPane`, `EditorTabs`, `FileTree`, `BottomTerminal`,
  and workspace store instead of creating a parallel mobile app.
- Preserve xterm lifecycle guarantees: collapsed or hidden panes must not remount or
  lose terminal history because the user switches screens.
- Keep desktop and tablet behavior unchanged unless a viewport crosses the mobile
  breakpoint.
- Use Mexus console styling: near-black surfaces, thin dividers, compact controls,
  restrained accent color, low-radius UI.

## Non-Goals

- No new server API or WebSocket protocol for mobile.
- No native mobile app, PWA install flow, or push notifications.
- No redesign of Review, Team, Replay, or file preview content for this phase.
- No new Agent chat abstraction separate from the existing terminal-based Pane model.
- No attempt to show multiple desktop columns side by side on phone.

## Chosen Information Architecture

Mobile maps the existing desktop columns to three mutually exclusive workspace screens:

```text
Panes | Editor | Files
```

`Panes` is the default mobile screen because the primary mobile use case is communicating
with Agents. `Editor` keeps the existing `EditorTabs` surface available for Activity,
Team, Review, Replay, file preview, and Git diff. `Files` keeps the existing `FileTree`
available for navigation.

This is preferred over inventing mobile-specific concepts such as `Agents / Workspace /
Files`, because the current code and user mental model already use the three desktop
columns. Mobile should change presentation, not the product model.

## Considered Approaches

### Recommended: Responsive Single-Screen Shell

`Layout` keeps rendering the same three panel components, but below the mobile breakpoint
only the active panel is visible. A compact mobile switcher changes the active panel.

Benefits:

- Minimal conceptual drift from desktop.
- Keeps the same component ownership and WebSocket event flow.
- Avoids a duplicate mobile route or duplicated panel implementations.
- Lets terminal components remain mounted when needed, preserving buffered output.

Trade-off:

- `Layout` needs clearer panel boundaries and a small amount of viewport-mode state.

### Alternative: Separate `MobileLayout`

Create a dedicated mobile layout component that reuses inner panel components but owns
its own shell, headers, and navigation.

Benefits:

- Easier to reason about mobile markup in isolation.
- Less conditional logic inside the existing `Layout` render.

Trade-off:

- High risk of desktop/mobile behavior drift.
- More duplication around dialogs, filters, pane creation, settings, keyboard shortcuts,
  and bottom terminal integration.

### Alternative: Pane-Only Mobile MVP

Only expose the Pane stack on phone and hide Editor and Files completely.

Benefits:

- Fastest implementation.
- Strongly focused on Agent communication.

Trade-off:

- Users cannot inspect Review, Activity, diffs, or files from a phone.
- Creates an obvious dead end once an Agent asks the user to inspect a change.

## Mobile Layout Model

### Breakpoint

Use a CSS-driven mobile breakpoint around `860px` width. This aligns with existing
settings responsive rules and comfortably covers phones and narrow browser windows.

Recommended viewport categories:

- Desktop: `> 860px`, current multi-column layout.
- Mobile: `<= 860px`, one workspace screen at a time.

Tablet behavior can remain desktop-like for now. A later pass can add a two-panel tablet
mode if real usage demands it.

### Screen State

Add a mobile workspace screen state:

```ts
type MobileWorkspaceScreen = 'panes' | 'editor' | 'files'
```

This state should live in `Layout` initially. It is presentation state, not workspace
domain state. Persist it to local storage only if testing shows users frequently switch
away from `Panes` and expect refresh to restore that choice. The first version should
default to `panes` on mobile.

When the viewport transitions from desktop to mobile:

- If an editor tab is active because the user opened a file or review from another
  interaction, mobile switches to `editor`.
- Otherwise default to `panes`.

When the viewport transitions from mobile to desktop:

- Clear mobile-only visibility constraints.
- Keep existing desktop widths and active pane state.

### Mobile Navigation

Add a compact mobile workspace switcher that appears only below the mobile breakpoint.
It should be part of the workspace shell, not a separate route.

Recommended placement:

- Directly under the app header when the header is visible.
- At the top of the workspace body when `hideHeader` is true, including Hub embedded
  workspace mode.

Navigation items:

- `Panes`
- `Editor`
- `Files`

Each item should use the shared UI primitives where possible, preferably a segmented
control or compact tab control. The active item uses `accent-muted` background and an
accent border. Do not use a large colored mobile nav bar.

Small status hints are allowed if they use existing reliable data:

- `Panes`: visible pane count.
- `Editor`: active tab label or tab count.
- `Files`: omit count unless the current tree can provide it cheaply.

### Panel Visibility

On mobile, the workspace body should occupy the full available height under the header
and mobile switcher. Only the active screen is visible:

- `panes`: render the pane panel at `width: 100%`.
- `editor`: render the editor panel at `width: 100%`.
- `files`: render the files panel at `width: 100%`.

Resize handles are hidden on mobile. Desktop panel width preferences are ignored while
mobile is active and restored automatically when returning to desktop.

`filesCollapsed` should not apply on mobile. The Files screen is either selected and
full width, or not visible. The desktop collapsed file rail remains desktop-only.

## Pane Screen

The Pane screen is the mobile default and should be usable with one hand.

### Pane List Behavior

Keep the existing exclusive expanded Pane model:

- One expanded Pane fills the available Pane screen.
- Collapsed Panes remain compact rows above or below it.
- If no Pane is active, the Pane screen shows the list and the create-empty state.

On mobile, collapsed Pane rows should always expose essential actions through a touch-safe
pattern, because hover does not exist:

- Keep the whole row tappable to expand.
- Show low-noise action buttons only for the expanded Pane by default.
- Destructive or less common actions such as close can remain behind an overflow menu in
  a later phase; for this phase, existing buttons stay visible only on the expanded Pane.

### Terminal Fit

`AgentPane` already keeps the terminal mounted and pauses writes when collapsed. Mobile
screen switching must respect that behavior:

- Switching to `Panes` should refit and resume the active Pane terminal.
- Switching away from `Panes` should avoid rendering the active terminal at zero size
  without notifying the registry.
- The implementation should prefer CSS visibility/layout changes that keep mounted
  components stable, then call existing `refitTerminal`, `resumeTerminal`, and resize
  event paths when the Pane screen becomes visible.

The design should not add mobile-specific terminal writers or bypass `terminalRegistry`.

### Header Density

Mobile Pane headers should remain compact:

- Pane title remains one line with ellipsis.
- Preview/task text uses at most one line while collapsed.
- Expanded task disclosure remains available and caps at `30vh` on mobile.
- Icon buttons should have at least a coarse-pointer touch target while preserving the
  low-noise visual style.

## Editor Screen

The Editor screen reuses `EditorTabs` directly. It is the mobile place for:

- Activity
- Team
- Review
- Replay
- File preview
- Git diff

No new mobile Review or Activity flow is introduced in this phase.

Requirements:

- `EditorTabs` must fill the available mobile screen.
- Existing tab controls should horizontally scroll or compact rather than overflow.
- Opening a file from the Files screen should switch to `editor` after the tab opens.
- Opening Review from keyboard shortcuts or command palette should switch to `editor`
  on mobile.
- Editor maximize is unnecessary on mobile and should either be hidden or treated as
  a no-op, because the editor already owns the full screen.

## Files Screen

The Files screen reuses `FileTree`.

Requirements:

- File tree fills the mobile screen under the mobile switcher.
- Existing file tree header actions remain available, but compressed into a compact
  toolbar if horizontal space is tight.
- Selecting a file opens the existing file tab and switches to `editor`.
- The desktop file collapsed rail is hidden on mobile.

The current file tree is acceptable for the first mobile pass. The broader file tree
upgrade to `trees.software` / `@pierre/trees` remains a separate design concern.

## Bottom Terminal

The bottom shell terminal is secondary on phone because the primary mobile workflow is
Agent Pane communication.

Phase one behavior:

- Keep `BottomTerminal` available, but make its closed trigger mobile-safe.
- When opened on mobile, it covers the workspace body as an overlay rather than sharing
  vertical space with the active screen.
- Its shell list collapses into a compact selector above the terminal.
- Existing shell pane state, `__shell__` filtering, and terminal registry behavior remain
  unchanged.

The Agent Pane screen must not depend on bottom terminal work. If implementation needs
to be split, land the workspace screen switcher first and keep the existing bottom
terminal closed by default until the overlay is ready.

## Dialogs And Command Palette

Existing dialogs should remain shared:

- `AddPaneDialog`
- `SettingsDialog`
- `CommandPalette`

Mobile-specific requirements:

- Dialog shells should fit within the visual viewport with internal scrolling.
- Primary actions stay visible at the bottom of the dialog.
- `CommandPalette` should use nearly full width on phone with compact rows.
- Creating a Pane from mobile should close the dialog and switch to `panes`.

## Data Flow

No protocol changes are needed.

Existing event flow remains:

```text
WebSocket -> WorkspaceApp -> workspaceStore -> Layout -> active screen component
terminal.output -> terminalRegistry -> mounted xterm writer
terminal.input <- AgentPane/BottomTerminal
```

Mobile screen switching is local presentation state. It should not alter:

- `PaneState`
- `WorkspaceState`
- `ClientEvent`
- `ServerEvent`
- PTY lifecycle
- `.nexus/config.yaml`
- `.nexus/agents.yaml`

## Component Boundaries

Recommended implementation boundaries:

- `Layout.tsx`
  - Owns mobile screen state.
  - Detects responsive mode.
  - Renders mobile switcher.
  - Applies mobile-only visibility to the existing Panes, Editor, and Files panels.

- `AgentPane.tsx`
  - Keeps terminal lifecycle behavior.
  - Adds small responsive class hooks only for mobile density and touch target styling.

- `EditorTabs.tsx`
  - Handles narrow tab strip behavior.
  - Exposes or uses existing callbacks so file/review opens can switch to `editor`
    when called from mobile.

- `FileTree.tsx`
  - Keeps existing file open behavior.
  - Allows `Layout` or store-driven tab activation to switch mobile screen to `editor`.

- `globals.css`
  - Defines mobile workspace shell classes.
  - Hides resize handles and desktop-only collapsed file rail on mobile.
  - Adds coarse-pointer touch target adjustments where missing.

Avoid scattering viewport checks throughout business components. The responsive shell
should be centralized in `Layout` and CSS as much as possible.

## Accessibility And Touch

- All mobile switcher controls need labels and visible focus states.
- Touch targets should be at least 36px high for primary navigation and frequent actions.
- Do not rely on hover to reveal required actions on mobile.
- Terminal focus should remain explicit: tapping inside xterm focuses the terminal.
- Screen changes should not steal focus from an active text input unless the user tapped
  a navigation control.

## Error Handling

Mobile does not introduce new failure modes at the protocol level. It should preserve
existing error surfaces:

- Disconnected/reconnecting state remains visible in existing headers or panels.
- Pane create failures continue through `nexus-pane-create-failed`.
- File loading and Git diff errors remain in their current components.

If a mobile screen has no content:

- `Panes`: use existing no-pane empty state.
- `Editor`: show current default pinned tab content.
- `Files`: use existing file tree loading or empty state.

## Testing And Verification

Focused tests:

- `Layout` renders desktop multi-column layout above the mobile breakpoint.
- `Layout` renders only the active mobile screen below the breakpoint.
- Mobile switcher changes visible screen without changing `activePaneId`.
- Creating a pane on mobile switches or remains on `panes`.
- Opening a file from `files` activates an editor tab and switches to `editor`.

Manual verification:

- Phone viewport around `390x844`.
- Narrow landscape viewport around `844x390`.
- Desktop viewport around `1440x900`.
- Active Agent Pane terminal receives input after switching away and back.
- Terminal output continues buffering while a Pane is not visible.
- Resize handles are absent on mobile and restored on desktop.
- Bottom terminal closed trigger remains reachable on phone.

Build verification:

- Run the web test suite or focused component tests.
- Run `pnpm --filter @nexus/web build`.

## Rollout Plan

1. Add responsive mode detection and `MobileWorkspaceScreen` state in `Layout`.
2. Extract the existing Panes, Editor, and Files panel markup into local render helpers
   inside `Layout` to reduce conditional duplication.
3. Add the mobile switcher and mobile CSS classes.
4. Hide resize handles and desktop file collapse rail on mobile.
5. Wire mobile screen transitions for create pane, open file, and open review flows.
6. Add focused tests for mobile screen switching and desktop preservation.
7. Verify terminal refit/resume behavior on mobile viewport changes.

## Implementation Defaults

- Do not persist the last selected mobile screen. Mobile defaults to `panes` unless an
  explicit action opens Editor.
- Include the mobile bottom terminal overlay in the same feature only after the main
  workspace screen switcher is stable. The screen switcher is the required deliverable.
- Defer tablet-specific two-screen layout. Tablet keeps desktop behavior until phone
  support is working and real usage shows the need.
