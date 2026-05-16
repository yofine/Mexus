import type { MockPane } from '../mocks/types';
import { Icon } from './primitives';
import { GhostButton, PaneRow } from './atoms';

interface Props {
  panes: MockPane[];
  selectedId?: string;
  assetsBase?: string;
  onSelect?: (id: string) => void;
  onAdd?: () => void;
  onFilter?: () => void;
}

export function PanesColumn({ panes, selectedId, assetsBase, onSelect, onAdd, onFilter }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--mx-bg-base)' }}>
      <div className="mx-panel-header">
        <div className="mx-panel-header__title">
          <Icon name="panels" size={14} />
          <span>Panes</span>
        </div>
        <div className="mx-panel-header__actions">
          <GhostButton icon="sliders" onClick={onFilter}>Filter</GhostButton>
          <GhostButton icon="plus" onClick={onAdd}>Add</GhostButton>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {panes.map((pane) => (
          <PaneRow
            key={pane.id}
            pane={pane}
            selected={selectedId === pane.id}
            assetsBase={assetsBase}
            onClick={() => onSelect?.(pane.id)}
          />
        ))}
      </div>
    </div>
  );
}
