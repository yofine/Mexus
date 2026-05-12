import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  Badge,
  DialogShell,
  EmptyState,
  ErrorBanner,
  IconButton,
  InlineNotice,
  PanelHeader,
  StatusDot,
  TabButton,
  TabList,
  Toolbar,
  ToolbarGroup,
} from './index'

describe('ui kit primitives', () => {
  it('renders hard-edged status and badge primitives with semantic classes', () => {
    const html = renderToStaticMarkup(
      <div>
        <Badge variant="warning">Waiting</Badge>
        <StatusDot status="running" label="Connected" />
      </div>,
    )

    expect(html).toContain('ui-badge ui-badge--warning')
    expect(html).toContain('ui-status-dot ui-status-dot--running')
    expect(html).toContain('aria-label="Connected"')
  })

  it('renders icon buttons with accessible labels and size variants', () => {
    const html = renderToStaticMarkup(
      <IconButton aria-label="Open command palette" size="sm">
        <span>+</span>
      </IconButton>,
    )

    expect(html).toContain('ui-icon-button ui-icon-button--ghost ui-icon-button--sm')
    expect(html).toContain('aria-label="Open command palette"')
  })

  it('renders panel, toolbar, tabs, and feedback shells from the shared kit', () => {
    const html = renderToStaticMarkup(
      <section>
        <PanelHeader eyebrow="Workspace" title="Panes" description="3 running" actions={<IconButton aria-label="Add">+</IconButton>} />
        <Toolbar>
          <ToolbarGroup>
            <IconButton aria-label="Refresh">r</IconButton>
          </ToolbarGroup>
        </Toolbar>
        <TabList aria-label="Views">
          <TabButton active>Terminal</TabButton>
          <TabButton>Files</TabButton>
        </TabList>
        <DialogShell title="Settings" description="System preferences" footer={<button>Save</button>}>
          Body
        </DialogShell>
        <EmptyState title="No panes" description="Create a pane to begin." />
        <ErrorBanner title="Failed" message="Unable to load." />
        <InlineNotice variant="accent">Synced</InlineNotice>
      </section>,
    )

    expect(html).toContain('ui-panel-header')
    expect(html).toContain('ui-toolbar')
    expect(html).toContain('ui-tab-list')
    expect(html).toContain('ui-dialog-shell')
    expect(html).toContain('ui-empty-state')
    expect(html).toContain('ui-error-banner')
    expect(html).toContain('ui-inline-notice ui-inline-notice--accent')
  })
})

