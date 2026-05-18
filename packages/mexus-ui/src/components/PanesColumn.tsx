import type { MockPane } from '../mocks/types';
import { Icon } from './primitives';
import { GhostButton, PaneRow } from './atoms';
import { PaneTerminalPreview } from './PaneTerminalPreview';

interface Props {
  panes: MockPane[];
  selectedId?: string;
  expandedIds?: Set<string> | string[];
  assetsBase?: string;
  onSelect?: (id: string) => void;
  onToggleExpand?: (id: string) => void;
  onAdd?: () => void;
  onFilter?: () => void;
}

export function PanesColumn({
  panes, selectedId, expandedIds, assetsBase, onSelect, onToggleExpand, onAdd, onFilter,
}: Props) {
  const expandedSet =
    expandedIds instanceof Set ? expandedIds
    : Array.isArray(expandedIds) ? new Set(expandedIds)
    : new Set<string>();

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
      <div style={{ flex: 1, overflow: 'auto' }}>
        {panes.map((pane) => {
          const expanded = expandedSet.has(pane.id);
          return (
            <PaneRow
              key={pane.id}
              pane={pane}
              selected={selectedId === pane.id}
              expanded={expanded}
              assetsBase={assetsBase}
              onClick={() => onSelect?.(pane.id)}
              onToggleExpand={() => onToggleExpand?.(pane.id)}
            >
              {expanded && <PaneTerminalPreview pane={pane} />}
            </PaneRow>
          );
        })}
      </div>
    </div>
  );
}
