import type {
  MockActivityCard,
  MockFile,
  MockKanbanCol,
  MockPane,
  MockTimelineEntry,
} from '../mocks/types';
import {
  defaultActivityCards,
  defaultFiles,
  defaultKanban,
  defaultPanes,
  defaultTimeline,
} from '../mocks/workspace';
import { AppTopBar, type AppTab } from './AppTopBar';
import { PanesColumn } from './PanesColumn';
import { ActivityPanel } from './ActivityPanel';
import { TeamPanel } from './TeamPanel';
import { FilesPanel } from './FilesPanel';
import { StatusBar } from './StatusBar';

export interface WorkspaceMockProps {
  panes?: MockPane[];
  activityCards?: MockActivityCard[];
  timeline?: MockTimelineEntry[];
  files?: MockFile[];
  kanban?: MockKanbanCol[];
  tabs?: AppTab[];
  /** 'activity' shows the activity-grid center, 'team' shows the kanban center. */
  center?: 'activity' | 'team';
  assetsBase?: string;
  className?: string;
  /** Project name shown in the bottom Terminal bar. */
  projectLabel?: string;
}

const DEFAULT_TABS: AppTab[] = [
  { id: 't1', name: 'shop',       port: 7700, path: 'workspace/shop',       status: 'running', active: true },
  { id: 't2', name: 'astro-blog', port: 7702, path: 'workspace/astro-blog', status: 'running' },
];

export function WorkspaceMock({
  panes = defaultPanes,
  activityCards = defaultActivityCards,
  timeline: _timeline = defaultTimeline,
  files = defaultFiles,
  kanban = defaultKanban,
  tabs = DEFAULT_TABS,
  center = 'activity',
  assetsBase,
  className,
  projectLabel = 'shop',
}: WorkspaceMockProps) {
  return (
    <div className={`mx-root mx-frame ${className || ''}`}>
      <AppTopBar tabs={tabs} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr)',
        minHeight: 520,
        borderBottom: '1px solid var(--mx-border-default)',
      }}>
        <section style={{
          borderRight: '1px solid var(--mx-border-subtle)',
          minWidth: 0,
        }}>
          <PanesColumn panes={panes} assetsBase={assetsBase} />
        </section>

        <section style={{ minWidth: 0 }}>
          {center === 'team'
            ? <TeamPanel kanban={kanban} />
            : <ActivityPanel cards={activityCards} panes={panes} assetsBase={assetsBase} />}
        </section>

        <FilesPanel files={files} />
      </div>

      <StatusBar
        shellLabel="shell 2"
        projectLabel={projectLabel}
        branch="main"
        changes={0}
        shells={3}
      />
    </div>
  );
}
