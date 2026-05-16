import type { MockKanbanCol, MockPane } from '../mocks/types';
import { defaultKanban, defaultPanes } from '../mocks/workspace';
import { AppTopBar, type AppTab } from './AppTopBar';
import { PanesColumn } from './PanesColumn';
import { TeamPanel } from './TeamPanel';
import { FilesPanel } from './FilesPanel';
import { defaultFiles } from '../mocks/workspace';
import { StatusBar } from './StatusBar';

const DEFAULT_TABS: AppTab[] = [
  { id: 't1', name: 'shop', port: 7700, path: 'workspace/shop', status: 'running', active: true },
  { id: 't2', name: 'astro-blog', port: 7702, path: 'workspace/astro-blog', status: 'running' },
];

export interface TeamMockProps {
  kanban?: MockKanbanCol[];
  panes?: MockPane[];
  tabs?: AppTab[];
  assetsBase?: string;
  missionName?: string;
  missionDescription?: string;
}

export function TeamMock({
  kanban = defaultKanban,
  panes = defaultPanes,
  tabs = DEFAULT_TABS,
  assetsBase,
  missionName,
  missionDescription,
}: TeamMockProps) {
  return (
    <div className="mx-root mx-frame">
      <AppTopBar tabs={tabs} />
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr)',
        minHeight: 520,
        borderBottom: '1px solid var(--mx-border-default)',
      }}>
        <section style={{ borderRight: '1px solid var(--mx-border-subtle)', minWidth: 0 }}>
          <PanesColumn panes={panes} assetsBase={assetsBase} />
        </section>
        <section style={{ minWidth: 0 }}>
          <TeamPanel kanban={kanban} missionName={missionName} missionDescription={missionDescription} />
        </section>
        <FilesPanel files={defaultFiles} />
      </div>
      <StatusBar shellLabel="shell 2" projectLabel="shop" branch="main" changes={0} shells={3} />
    </div>
  );
}
