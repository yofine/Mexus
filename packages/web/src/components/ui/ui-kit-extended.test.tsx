import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  AgentIdentity,
  CommandGroup,
  CommandItem,
  CompactCard,
  ConfirmDialog,
  EntityRow,
  Field,
  FormRow,
  HubInstanceCard,
  HubInstanceRow,
  KeyValueMeta,
  LoadingState,
  MetaRow,
  MissionAgentRow,
  PaneCard,
  PaneStackRow,
  SearchInput,
  SectionHeader,
  SegmentedControl,
  TaskCard,
  TreeContainer,
  TreeNodeRow,
} from './index'

describe('extended ui kit primitives', () => {
  it('renders form, search, segmented, and loading primitives', () => {
    const html = renderToStaticMarkup(
      <div>
        <SegmentedControl
          aria-label="Mode"
          value="compact"
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'full', label: 'Full' },
          ]}
          onValueChange={() => {}}
        />
        <Field label="Name" description="Pane name">
          <input />
        </Field>
        <FormRow label="Shell" value="/bin/zsh" />
        <SearchInput aria-label="Search files" value="src" onChange={() => {}} />
        <LoadingState title="Loading" description="Reading workspace" />
      </div>,
    )

    expect(html).toContain('ui-segmented-control')
    expect(html).toContain('ui-segmented-control__item--active')
    expect(html).toContain('ui-field')
    expect(html).toContain('ui-form-row')
    expect(html).toContain('ui-search-input')
    expect(html).toContain('ui-loading-state')
  })

  it('renders pane and agent primitives with only existing pane metadata', () => {
    const html = renderToStaticMarkup(
      <div>
        <AgentIdentity agent="claudecode" name="Claude Code" color="#D97757" detail="running" />
        <MetaRow>
          <KeyValueMeta label="ctx" value="42%" />
          <KeyValueMeta label="cost" value="$0.123" />
        </MetaRow>
        <PaneCard
          name="Auth Refactor"
          agent="Claude Code"
          status="waiting"
          color="#7C6AF7"
          task="Refactor auth middleware"
          meta={['feature/auth', '3 files', '42% ctx']}
        />
        <PaneStackRow
          name="Tests"
          agent="Codex"
          status="running"
          color="#10A37F"
          description="Update auth tests"
          meta={['main']}
        />
      </div>,
    )

    expect(html).toContain('ui-agent-identity')
    expect(html).toContain('ui-meta-row')
    expect(html).toContain('ui-pane-card ui-pane-card--waiting')
    expect(html).toContain('ui-pane-stack-row ui-pane-stack-row--running')
    expect(html).toContain('Refactor auth middleware')
  })

  it('renders entity, command, tree, and confirm primitives', () => {
    const html = renderToStaticMarkup(
      <div>
        <SectionHeader title="Team" description="Mission state" />
        <CompactCard title="Mission Agent" description="Coordinates work" />
        <EntityRow title="Hub instance" meta=":7700" status="running" />
        <CommandGroup heading="Pane">
          <CommandItem label="Restart Current Pane" shortcut="cmd r" />
        </CommandGroup>
        <TreeContainer aria-label="Files">
          <TreeNodeRow depth={1} name="src" kind="directory" expanded gitStatus="modified" />
          <TreeNodeRow depth={2} name="App.tsx" kind="file" active agentColor="#7C6AF7" />
        </TreeContainer>
        <ConfirmDialog title="Remove pane" description="This will close the pane." confirmLabel="Remove" cancelLabel="Cancel" />
      </div>,
    )

    expect(html).toContain('ui-section-header')
    expect(html).toContain('ui-compact-card')
    expect(html).toContain('ui-entity-row')
    expect(html).toContain('ui-command-group')
    expect(html).toContain('ui-command-item')
    expect(html).toContain('ui-tree-container')
    expect(html).toContain('ui-tree-node-row ui-tree-node-row--directory')
    expect(html).toContain('ui-confirm-dialog')
  })

  it('renders Team and Hub entity primitives without requiring new product features', () => {
    const html = renderToStaticMarkup(
      <div>
        <MissionAgentRow name="Marbas" responsibility="Mission-aware pane creation" />
        <TaskCard
          refId="T-1"
          to="Marbas"
          from="Squad Lead"
          status="In Progress"
          scope="packages/web"
          request="Build UI primitives"
          updated="just now"
          reviewed
        />
        <HubInstanceRow
          name="Nexus"
          cwd="/root/workspace/Nexus"
          port={7700}
          status="running"
          connected
        />
        <HubInstanceCard
          name="Nexus"
          cwd="/root/workspace/Nexus"
          port={7700}
          status="running"
          meta={<KeyValueMeta label="pid" value="12345" />}
        />
      </div>,
    )

    expect(html).toContain('ui-mission-agent-row')
    expect(html).toContain('ui-task-card ui-task-card--in-progress')
    expect(html).toContain('ui-hub-instance-row ui-hub-instance-row--connected')
    expect(html).toContain('ui-hub-instance-card')
    expect(html).toContain('Mission-aware pane creation')
  })
})
