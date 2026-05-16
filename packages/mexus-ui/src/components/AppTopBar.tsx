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
}

export function AppTopBar({ hubActive = false, tabs, brandSub = 'Multi-agent execution', rightSlot }: Props) {
  return (
    <div className="mx-appbar">
      <div className="mx-appbar__brand">
        <span className="mx-appbar__brand-name">M.E.X.U.S.</span>
        <span className="mx-appbar__brand-sub">{brandSub}</span>
      </div>

      <div className="mx-appbar__tabs">
        <span className={`mx-appbar__hub ${hubActive ? 'mx-appbar__hub--active' : ''}`}>
          <Icon name="hub" size={12} />
          Hub
        </span>

        {tabs.map((tab) => (
          <span key={tab.id} className={`mx-appbar__tab ${tab.active ? 'mx-appbar__tab--active' : ''}`}>
            {tab.status && <StatusDot status={tab.status} />}
            <span className="mx-appbar__tab-name">{tab.name}</span>
            {tab.port !== undefined && <span className="mx-appbar__tab-port">:{tab.port}</span>}
            {tab.path && <span className="mx-appbar__tab-path">{tab.path}</span>}
            <span className="mx-appbar__tab-close"><Icon name="x" size={11} strokeWidth={2.2} /></span>
          </span>
        ))}

        <span style={{ flex: 1 }} />
      </div>

      {rightSlot ?? (
        <span className="mx-appbar__settings">
          <Icon name="settings" size={14} />
        </span>
      )}
    </div>
  );
}
