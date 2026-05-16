import type { MockPane } from '../mocks/types';
import { ChevronRight, Icon, PaneAvatar } from './primitives';

interface Props {
  panes: MockPane[];
  assetsBase?: string;
}

export function PanesColumn({ panes, assetsBase }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--mx-bg-base)' }}>
      <div className="mx-panel-header">
        <div className="mx-panel-header__title">
          <Icon name="panels" size={14} />
          <span>Panes</span>
        </div>
        <div className="mx-panel-header__actions">
          <button type="button" className="mx-ghost-btn">
            <Icon name="sliders" size={11} />
            Filter
          </button>
          <button type="button" className="mx-ghost-btn">
            <Icon name="plus" size={12} />
            Add
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {panes.map((pane) => (
          <PaneRow key={pane.id} pane={pane} assetsBase={assetsBase} />
        ))}
      </div>
    </div>
  );
}

function PaneRow({ pane, assetsBase }: { pane: MockPane; assetsBase?: string }) {
  return (
    <div className="mx-pane-row">
      <span className="mx-pane-row__chev"><ChevronRight size={11} /></span>
      <PaneAvatar hue={pane.hue} agent={pane.agent} size={32} assetsBase={assetsBase} />
      <div className="mx-pane-row__main">
        <div className="mx-pane-row__name">{pane.name}</div>
        {pane.desc && <div className="mx-pane-row__desc">{pane.desc}</div>}
      </div>
    </div>
  );
}
