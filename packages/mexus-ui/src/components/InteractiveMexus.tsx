import { useMemo, useState } from 'react';
import type {
  MockActivityCard,
  MockFile,
  MockHubInstance,
  MockKanbanCard,
  MockKanbanCol,
  MockPane,
} from '../mocks/types';
import {
  defaultActivityCards,
  defaultFiles,
  defaultKanban,
  defaultPanes,
} from '../mocks/workspace';
import { defaultHubInstances } from '../mocks/hub';
import { AppTopBar, type AppTab } from './AppTopBar';
import { PanesColumn } from './PanesColumn';
import { ActivityPanel } from './ActivityPanel';
import { TeamPanel } from './TeamPanel';
import { FilesPanel } from './FilesPanel';
import { StatusBar } from './StatusBar';
import { AccentButton, FormField, HubInstanceCard } from './atoms';
import { Icon } from './primitives';

/**
 * Fully-interactive Mexus mock. Everything that's stateful in the real app is
 * stateful here too — only the data is fabricated. The component is intended
 * for the marketing component gallery and is the single source of "what the
 * new UI feels like".
 */
export interface InteractiveMexusProps {
  initialPanes?: MockPane[];
  initialActivity?: MockActivityCard[];
  initialKanban?: MockKanbanCol[];
  initialFiles?: MockFile[];
  initialInstances?: MockHubInstance[];
  assetsBase?: string;
}

type Tab = 'Activity' | 'Team' | 'Review' | 'Replay';
type SubtabActivity = 'Agent' | 'Modules' | 'Imports' | 'Conflicts' | 'Files';
type SubtabTeam = 'Kanban' | 'Mission Agents' | 'Squad Lead Log';

interface WorkspaceState {
  id: string;
  projectName: string;
  port: number;
  cwd: string;
  selectedPaneId?: string;
  expandedPaneIds: string[];
  tab: Tab;
  subtabActivity: SubtabActivity;
  subtabTeam: SubtabTeam;
}

function makeWorkspaceState(inst: MockHubInstance): WorkspaceState {
  return {
    id: inst.id,
    projectName: inst.projectName,
    port: inst.port,
    cwd: inst.cwd,
    selectedPaneId: undefined,
    expandedPaneIds: [],
    tab: 'Activity',
    subtabActivity: 'Agent',
    subtabTeam: 'Kanban',
  };
}

export function InteractiveMexus({
  initialPanes = defaultPanes,
  initialActivity = defaultActivityCards,
  initialKanban = defaultKanban,
  initialFiles = defaultFiles,
  initialInstances = defaultHubInstances,
  assetsBase,
}: InteractiveMexusProps) {
  // Instances ↔ tabs are 1:1 in this demo.
  const [instances, setInstances] = useState<MockHubInstance[]>(initialInstances);
  const [workspaces, setWorkspaces] = useState<Record<string, WorkspaceState>>(() =>
    Object.fromEntries(initialInstances.map((i) => [i.id, makeWorkspaceState(i)]))
  );
  const [panesByWs, setPanesByWs] = useState<Record<string, MockPane[]>>(() =>
    Object.fromEntries(initialInstances.map((i) => [i.id, initialPanes]))
  );
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    initialInstances[0]?.id ?? null
  );
  const [view, setView] = useState<'hub' | 'workspace'>('workspace');
  const [toast, setToast] = useState<string | null>(null);

  // Hub form state (controlled so "Create server" picks current values).
  const [newPath, setNewPath] = useState('~/projects/my-app');
  const [newPort, setNewPort] = useState('Auto assign');

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2200);
  };

  const tabs: AppTab[] = useMemo(
    () => instances.map((inst) => ({
      id: inst.id,
      name: inst.projectName,
      port: inst.port,
      path: `workspace/${inst.projectName}`,
      status: inst.status === 'running' ? 'running' : 'idle',
      active: view === 'workspace' && activeWorkspaceId === inst.id,
    })),
    [instances, activeWorkspaceId, view]
  );

  const activeWs = activeWorkspaceId ? workspaces[activeWorkspaceId] : undefined;

  // ── Handlers ────────────────────────────────────────────────
  const openTab = (id: string) => {
    setActiveWorkspaceId(id);
    setView('workspace');
  };

  const closeTab = (id: string) => {
    setInstances((prev) => {
      const next = prev.filter((i) => i.id !== id);
      if (activeWorkspaceId === id) {
        const fallback = next[0]?.id ?? null;
        setActiveWorkspaceId(fallback);
        if (!fallback) setView('hub');
      }
      return next;
    });
    setWorkspaces((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPanesByWs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    flash(`Closed tab "${id}"`);
  };

  const removeInstance = (id: string) => closeTab(id);

  const createInstance = () => {
    // Pick a name from the path's last segment; default to "new-app-N".
    const seg = newPath.split('/').filter(Boolean).pop() ?? 'project';
    let name = seg.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'project';
    let suffix = 1;
    while (instances.some((i) => i.id === name || i.projectName === name)) {
      suffix += 1;
      name = `${seg}-${suffix}`;
    }
    const port = newPort === 'Auto assign'
      ? 7700 + instances.length + 1
      : Number.parseInt(newPort, 10) || 7700 + instances.length + 1;
    const fresh: MockHubInstance = {
      id: name,
      projectName: name,
      port,
      cwd: newPath,
      status: 'running',
      uptime: 'just now',
      panes: 1,
      pid: 30000 + Math.floor(Math.random() * 9000),
    };
    setInstances((prev) => [...prev, fresh]);
    setWorkspaces((prev) => ({ ...prev, [fresh.id]: makeWorkspaceState(fresh) }));
    setPanesByWs((prev) => ({ ...prev, [fresh.id]: initialPanes }));
    setActiveWorkspaceId(fresh.id);
    setView('workspace');
    flash(`Created server "${fresh.projectName}" on :${port}`);
  };

  const stopInstance = (id: string) => {
    setInstances((prev) => prev.map((i) => i.id === id ? { ...i, status: 'idle' } : i));
    flash(`Stopped "${id}"`);
  };

  const addPane = () => {
    if (!activeWorkspaceId) return;
    const base = panesByWs[activeWorkspaceId] ?? [];
    const n = base.length + 1;
    const palette = [270, 20, 200, 320, 45, 5];
    const agents = ['claude', 'codex', 'gemini', 'opencode'];
    const fresh: MockPane = {
      id: `pane-${Date.now().toString(36)}`,
      name: `New pane ${n}`,
      desc: 'Fresh tab — assign work to start',
      agent: agents[n % agents.length],
      hue: palette[n % palette.length],
      status: 'idle',
    };
    setPanesByWs((prev) => ({ ...prev, [activeWorkspaceId]: [...base, fresh] }));
    flash(`Added pane "${fresh.name}"`);
  };

  const updateWs = (patch: Partial<WorkspaceState>) => {
    if (!activeWorkspaceId) return;
    setWorkspaces((prev) => ({
      ...prev,
      [activeWorkspaceId]: { ...prev[activeWorkspaceId], ...patch },
    }));
  };

  const togglePaneExpand = (paneId: string) => {
    if (!activeWorkspaceId) return;
    setWorkspaces((prev) => {
      const ws = prev[activeWorkspaceId];
      if (!ws) return prev;
      const has = ws.expandedPaneIds.includes(paneId);
      const expandedPaneIds = has
        ? ws.expandedPaneIds.filter((id) => id !== paneId)
        : [...ws.expandedPaneIds, paneId];
      return { ...prev, [activeWorkspaceId]: { ...ws, expandedPaneIds } };
    });
  };

  // ── Render ──────────────────────────────────────────────────
  const wsPanes = activeWorkspaceId ? (panesByWs[activeWorkspaceId] ?? initialPanes) : initialPanes;

  return (
    <div className="mx-root mx-frame" style={{ position: 'relative' }}>
      <AppTopBar
        hubActive={view === 'hub'}
        tabs={tabs}
        onHubClick={() => setView('hub')}
        onTabClick={openTab}
        onTabClose={closeTab}
        onSettingsClick={() => flash('Settings panel (not implemented in demo)')}
      />

      {view === 'hub' || !activeWs ? (
        <HubView
          instances={instances}
          newPath={newPath}
          newPort={newPort}
          onPathChange={setNewPath}
          onPortChange={setNewPort}
          onCreate={createInstance}
          onOpen={openTab}
          onStop={stopInstance}
          onRemove={removeInstance}
        />
      ) : (
        <WorkspaceView
          ws={activeWs}
          panes={wsPanes}
          activity={initialActivity}
          kanban={initialKanban}
          files={initialFiles}
          assetsBase={assetsBase}
          updateWs={updateWs}
          onAddPane={addPane}
          onFilter={() => flash('Filter (not implemented in demo)')}
          onMissionSelectorClick={() => flash('Mission switcher (not implemented in demo)')}
          onNewMission={() => flash('New Mission wizard (not implemented in demo)')}
          onAgentClick={(id) => flash(`Selected mission agent "${id}"`)}
          onKanbanCardClick={(card) => flash(`Opened kanban card ${card.id}`)}
          onFileClick={(name) => flash(`Open file "${name}"`)}
          onTogglePaneExpand={togglePaneExpand}
        />
      )}

      {toast && (
        <div style={{
          position: 'absolute',
          right: 14,
          bottom: 14,
          padding: '8px 12px',
          borderRadius: 'var(--mx-radius-md)',
          background: 'var(--mx-bg-elevated)',
          border: '1px solid var(--mx-border-default)',
          color: 'var(--mx-text-primary)',
          fontFamily: 'var(--mx-font-mono)',
          fontSize: 11.5,
          zIndex: 30,
          pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

/* ── Hub view ───────────────────────────────────────────────── */

function HubView({
  instances, newPath, newPort, onPathChange, onPortChange, onCreate, onOpen, onStop, onRemove,
}: {
  instances: MockHubInstance[];
  newPath: string;
  newPort: string;
  onPathChange: (v: string) => void;
  onPortChange: (v: string) => void;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onStop: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 24,
      padding: '20px 24px',
      minHeight: 480,
      borderBottom: '1px solid var(--mx-border-default)',
    }}>
      <section style={{ width: 520, maxWidth: '40%', flexShrink: 0 }}>
        <div className="mx-hub-section-title">
          {instances.length} tracked instance{instances.length === 1 ? '' : 's'}
        </div>
        <div className="mx-hub-section-sub">Local execution servers</div>
        <div className="mx-hub-section-rule" />

        {instances.length === 0 ? (
          <div style={{
            padding: 18,
            border: '1px dashed var(--mx-border-default)',
            borderRadius: 'var(--mx-radius-md)',
            color: 'var(--mx-text-muted)',
            fontFamily: 'var(--mx-font-mono)',
            fontSize: 12,
          }}>
            No servers tracked yet. Use the form on the right to create one.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {instances.map((inst) => (
              <HubInstanceCard
                key={inst.id}
                instance={inst}
                onOpen={() => onOpen(inst.id)}
                onStop={() => onStop(inst.id)}
                onRemove={() => onRemove(inst.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section style={{ width: 340, maxWidth: '28%', flexShrink: 0 }}>
        <div className="mx-hub-section-title">Start execution server</div>
        <div className="mx-hub-section-sub">New execution server</div>
        <div style={{ marginTop: 18 }}>
          <ControlledField label="Project path" value={newPath} onChange={onPathChange} />
          <ControlledField label="Port" value={newPort} onChange={onPortChange} />
          <AccentButton icon="file-plus" onClick={onCreate}>Create server</AccentButton>
          <div className="mx-hub-help">
            Mexus Hub owns the tabs and connection state. The Hub view keeps the current
            server connection alive; opening another running server switches the active connection.
          </div>
        </div>
      </section>
    </div>
  );
}

function ControlledField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mx-form-field">
      <label className="mx-form-field__label">{label}</label>
      <input
        className="mx-form-field__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/* ── Workspace view ─────────────────────────────────────────── */

function WorkspaceView({
  ws, panes, activity, kanban, files, assetsBase, updateWs,
  onAddPane, onFilter, onMissionSelectorClick, onNewMission, onAgentClick,
  onKanbanCardClick, onFileClick, onTogglePaneExpand,
}: {
  ws: WorkspaceState;
  panes: MockPane[];
  activity: MockActivityCard[];
  kanban: MockKanbanCol[];
  files: MockFile[];
  assetsBase?: string;
  updateWs: (patch: Partial<WorkspaceState>) => void;
  onAddPane: () => void;
  onFilter: () => void;
  onMissionSelectorClick: () => void;
  onNewMission: () => void;
  onAgentClick: (id: string) => void;
  onKanbanCardClick: (card: MockKanbanCard) => void;
  onFileClick: (name: string) => void;
  onTogglePaneExpand: (id: string) => void;
}) {
  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr)',
        minHeight: 520,
        borderBottom: '1px solid var(--mx-border-default)',
      }}>
        <section style={{ borderRight: '1px solid var(--mx-border-subtle)', minWidth: 0 }}>
          <PanesColumn
            panes={panes}
            selectedId={ws.selectedPaneId}
            expandedIds={ws.expandedPaneIds}
            assetsBase={assetsBase}
            onSelect={(id) => updateWs({ selectedPaneId: id })}
            onToggleExpand={onTogglePaneExpand}
            onAdd={onAddPane}
            onFilter={onFilter}
          />
        </section>

        <section style={{ minWidth: 0 }}>
          {ws.tab === 'Team' ? (
            <TeamPanel
              kanban={kanban}
              activeTab={ws.tab}
              activeSubtab={ws.subtabTeam}
              onTabChange={(t) => updateWs({ tab: t })}
              onSubtabChange={(s) => updateWs({ subtabTeam: s })}
              onMissionSelectorClick={onMissionSelectorClick}
              onNewMission={onNewMission}
              onAgentClick={onAgentClick}
              onCardClick={onKanbanCardClick}
            />
          ) : ws.tab === 'Review' ? (
            <PlaceholderPanel
              activeTab={ws.tab}
              onTabChange={(t) => updateWs({ tab: t })}
              title="Review"
              hint="Patch review, diff browsing, approve / request changes — coming online."
            />
          ) : ws.tab === 'Replay' ? (
            <PlaceholderPanel
              activeTab={ws.tab}
              onTabChange={(t) => updateWs({ tab: t })}
              title="Replay"
              hint="Time-travel through a pane's runs. Pick a session to scrub."
            />
          ) : (
            <ActivityPanel
              cards={activity}
              panes={panes}
              assetsBase={assetsBase}
              activeTab={ws.tab}
              activeSubtab={ws.subtabActivity}
              onTabChange={(t) => updateWs({ tab: t })}
              onSubtabChange={(s) => updateWs({ subtabActivity: s })}
              onCardClick={(id) => updateWs({ selectedPaneId: id })}
            />
          )}
        </section>

        <FilesPanel files={files} onFileClick={onFileClick} />
      </div>

      <StatusBar
        shellLabel="shell 2"
        projectLabel={ws.projectName}
        branch="main"
        changes={0}
        shells={3}
      />
    </>
  );
}

/* ── Placeholder panel for Review / Replay so tab clicks have feedback ── */

function PlaceholderPanel({
  activeTab, onTabChange, title, hint,
}: {
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
  title: string;
  hint: string;
}) {
  const TABS: Tab[] = ['Activity', 'Team', 'Review', 'Replay'];
  const TAB_ICONS = { Activity: 'activity', Team: 'team', Review: 'review', Replay: 'replay' } as const;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--mx-bg-base)' }}>
      <div className="mx-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={`mx-tab ${t === activeTab ? 'mx-tab--active' : ''}`}
            onClick={() => onTabChange(t)}
            style={{ background: 'transparent', border: 0, cursor: 'pointer', height: '100%' }}
          >
            <Icon name={TAB_ICONS[t]} size={12} />
            <span>{t}</span>
          </button>
        ))}
        <span style={{ flex: 1 }} />
      </div>
      <div style={{
        padding: '40px 24px',
        color: 'var(--mx-text-muted)',
        fontFamily: 'var(--mx-font-mono)',
        fontSize: 12,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 14, color: 'var(--mx-text-primary)', marginBottom: 8 }}>{title}</div>
        {hint}
      </div>
    </div>
  );
}
