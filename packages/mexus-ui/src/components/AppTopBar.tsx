import type { ReactNode } from 'react';
import { Icon, StatusDot } from './primitives';

export interface AppTab {
  id: string;
  name: string;
  port?: number;
  path?: string;
  status?: 'running' | 'waiting' | 'idle';
  active?: boolean;
}

interface Props {
  hubActive?: boolean;
  tabs: AppTab[];
  brandSub?: string;
  rightSlot?: ReactNode;
  onHubClick?: () => void;
  onTabClick?: (id: string) => void;
  onTabClose?: (id: string) => void;
  onSettingsClick?: () => void;
}

export function AppTopBar({
  hubActive = false,
  tabs,
  brandSub = 'Multi-agent execution',
  rightSlot,
  onHubClick,
  onTabClick,
  onTabClose,
  onSettingsClick,
}: Props) {
  return (
    <div className="mx-appbar">
      <div className="mx-appbar__brand">
        <span className="mx-appbar__brand-name">M.E.X.U.S.</span>
        <span className="mx-appbar__brand-sub">{brandSub}</span>
      </div>

      <div className="mx-appbar__tabs">
        <button
          type="button"
          className={`mx-appbar__hub ${hubActive ? 'mx-appbar__hub--active' : ''}`}
          onClick={onHubClick}
        >
          <Icon name="hub" size={12} />
          Hub
        </button>

        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`mx-appbar__tab ${tab.active ? 'mx-appbar__tab--active' : ''}`}
            onClick={() => onTabClick?.(tab.id)}
          >
            {tab.status && <StatusDot status={tab.status} />}
            <span className="mx-appbar__tab-name">{tab.name}</span>
            {tab.port !== undefined && <span className="mx-appbar__tab-port">:{tab.port}</span>}
            {tab.path && <span className="mx-appbar__tab-path">{tab.path}</span>}
            <span
              className="mx-appbar__tab-close"
              onClick={(e) => { e.stopPropagation(); onTabClose?.(tab.id); }}
              role="button"
              aria-label={`Close ${tab.name}`}
            >
              <Icon name="x" size={11} strokeWidth={2.2} />
            </span>
          </button>
        ))}

        <span style={{ flex: 1 }} />
      </div>

      {rightSlot ?? (
        <button type="button" className="mx-appbar__settings" onClick={onSettingsClick} aria-label="Settings">
          <Icon name="settings" size={14} />
        </button>
      )}
    </div>
  );
}
