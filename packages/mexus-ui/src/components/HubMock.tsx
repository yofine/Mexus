import type { MockHubInstance } from '../mocks/types';
import { defaultHubInstances } from '../mocks/hub';
import { AppTopBar, type AppTab } from './AppTopBar';
import { Icon } from './primitives';

export interface HubMockProps {
  instances?: MockHubInstance[];
  /** Tabs shown in the top bar alongside Hub. Default is one running tab per instance. */
  tabs?: AppTab[];
  className?: string;
}

export function HubMock({ instances = defaultHubInstances, tabs, className }: HubMockProps) {
  const computedTabs: AppTab[] = tabs ?? instances.slice(0, 3).map((inst, i) => ({
    id: 'tab-' + inst.id,
    name: inst.projectName,
    port: inst.port,
    path: `workspace/${inst.projectName}`,
    status: inst.status === 'running' ? 'running' : 'idle',
    active: i === 0,
  }));

  return (
    <div className={`mx-root mx-frame ${className || ''}`}>
      <AppTopBar hubActive tabs={computedTabs} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
        minHeight: 480,
        borderBottom: '1px solid var(--mx-border-default)',
      }}>
        {/* Left: instances */}
        <section style={{ padding: '20px 24px', borderRight: '1px solid var(--mx-border-subtle)' }}>
          <div className="mx-hub-section-title">{instances.length} tracked instance{instances.length === 1 ? '' : 's'}</div>
          <div className="mx-hub-section-sub">Local execution servers</div>
          <div className="mx-hub-section-rule" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {instances.map((inst) => (
              <HubInstanceCard key={inst.id} instance={inst} />
            ))}
          </div>
        </section>

        {/* Right: form */}
        <section style={{ padding: '20px 24px', background: 'var(--mx-bg-base)' }}>
          <div className="mx-hub-section-title">Start execution server</div>
          <div className="mx-hub-section-sub">New execution server</div>
          <div style={{ marginTop: 18 }}>
            <div className="mx-form-field">
              <label className="mx-form-field__label">Project path</label>
              <input className="mx-form-field__input" defaultValue="~/code/my-app" readOnly />
            </div>
            <div className="mx-form-field">
              <label className="mx-form-field__label">Port</label>
              <input className="mx-form-field__input" defaultValue="Auto assign" readOnly />
            </div>
            <button type="button" className="mx-btn-accent">
              <Icon name="file-plus" size={14} strokeWidth={2} />
              Create server
            </button>
            <div className="mx-hub-help">
              Mexus Hub owns the tabs and connection state. The Hub view keeps the current
              server connection alive; opening another running server switches the active connection.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function HubInstanceCard({ instance }: { instance: MockHubInstance }) {
  return (
    <div className="mx-hub-card">
      <div className="mx-hub-card__header">
        <span className="mx-hub-card__name">{instance.projectName}</span>
        <span className="mx-hub-card__meta">
          <span className="mx-hub-card__port mx-mono">:{instance.port}</span>
          <span className="mx-hub-card__state mx-mono">{instance.status}</span>
        </span>
      </div>
      <div className="mx-hub-card__body">
        <div className="mx-hub-card__cwd">{instance.cwd}</div>
        <div className="mx-hub-card__pillrow">
          {instance.pid !== undefined && (
            <span className="mx-hub-pid">pid <b>{instance.pid}</b></span>
          )}
          <span className="mx-hub-pid">started <b>{instance.uptime}</b></span>
        </div>
      </div>
      <div className="mx-hub-card__actions">
        <button className="mx-hub-action" type="button">
          <Icon name="open" size={11} strokeWidth={1.8} />
          Open
        </button>
        <button className="mx-hub-action" type="button">
          <Icon name="power" size={11} strokeWidth={1.8} />
          Stop
        </button>
        <button className="mx-hub-action" type="button">
          <Icon name="trash" size={11} strokeWidth={1.8} />
          Remove
        </button>
      </div>
    </div>
  );
}
