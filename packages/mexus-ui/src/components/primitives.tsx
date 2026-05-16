import type { CSSProperties, ReactNode } from 'react';
import { AgentIcon } from './AgentIcon';

/** Gradient square that hosts the agent brand icon, matching real Mexus pane avatars. */
export function PaneAvatar({ hue, agent, size = 32, assetsBase }: {
  hue: number;
  agent: string;
  size?: number;
  assetsBase?: string;
}) {
  const g1 = `hsl(${hue}, 70%, 60%)`;
  const g2 = `hsl(${(hue + 28) % 360}, 65%, 38%)`;
  const style: CSSProperties = {
    width: size,
    height: size,
    background: `linear-gradient(135deg, ${g1}, ${g2})`,
  };
  const inner = Math.round(size * 0.56);
  return (
    <span className="mx-avatar" style={style} aria-hidden="true">
      <AgentIcon agent={agent} size={inner} assetsBase={assetsBase} />
    </span>
  );
}

export function StatusDot({ status }: { status: 'running' | 'waiting' | 'idle' | 'error' }) {
  return <span className={`mx-dot mx-dot--${status}`} aria-hidden="true" />;
}

export function ChevronDown({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ChevronRight({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export type IconName =
  | 'panels' | 'activity' | 'team' | 'review' | 'replay'
  | 'folder' | 'folder-plus' | 'server' | 'plus' | 'play' | 'stop' | 'x'
  | 'settings' | 'sliders' | 'maximize' | 'open' | 'power' | 'trash'
  | 'terminal' | 'branch' | 'changes' | 'shell' | 'hub' | 'file' | 'file-plus';

export function Icon({ name, size = 14, strokeWidth = 1.8 }: {
  name: IconName; size?: number; strokeWidth?: number;
}) {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'panels':
      return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>;
    case 'activity':
      return <svg {...props}><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>;
    case 'team':
      return <svg {...props}><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75M22 21v-2a4 4 0 0 0-3-3.87" /></svg>;
    case 'review':
      return <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z" /></svg>;
    case 'replay':
      return <svg {...props}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></svg>;
    case 'folder':
      return <svg {...props}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>;
    case 'folder-plus':
      return <svg {...props}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M12 11v6M9 14h6" /></svg>;
    case 'server':
      return <svg {...props}><rect x="3" y="4" width="18" height="6" rx="2" /><rect x="3" y="14" width="18" height="6" rx="2" /><circle cx="7" cy="7" r=".5" fill="currentColor" /><circle cx="7" cy="17" r=".5" fill="currentColor" /></svg>;
    case 'hub':
      return <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
    case 'plus':
      return <svg {...props}><path d="M12 5v14M5 12h14" /></svg>;
    case 'play':
      return <svg {...props}><path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none" /></svg>;
    case 'stop':
      return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M9 9h6v6H9z" /></svg>;
    case 'power':
      return <svg {...props}><path d="M12 3v9" /><path d="M5.6 7.6a8 8 0 1 0 12.8 0" /></svg>;
    case 'trash':
      return <svg {...props}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>;
    case 'open':
      return <svg {...props}><path d="M7 17L17 7M9 7h8v8" /></svg>;
    case 'x':
      return <svg {...props}><path d="M6 6l12 12M6 18L18 6" /></svg>;
    case 'settings':
      return <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09c0 .66.39 1.25 1.03 1.51a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.26.64.85 1.03 1.51 1.03H21a2 2 0 1 1 0 4h-.09c-.66 0-1.25.39-1.51 1.03z" /></svg>;
    case 'sliders':
      return <svg {...props}><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>;
    case 'maximize':
      return <svg {...props}><path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" /></svg>;
    case 'terminal':
      return <svg {...props}><path d="M4 6l6 6-6 6M12 18h8" /></svg>;
    case 'shell':
      return <svg {...props}><path d="M4 6l6 6-6 6M12 18h8" /></svg>;
    case 'branch':
      return <svg {...props}><circle cx="6" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="8" r="2" /><path d="M6 8v8M6 18c12 0 12-10 12-10" /></svg>;
    case 'changes':
      return <svg {...props}><path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3M3 22v-6h6M21 2v6h-6" /></svg>;
    case 'file':
      return <svg {...props}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>;
    case 'file-plus':
      return <svg {...props}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M12 13v6M9 16h6" /></svg>;
  }
}

export function FrameChrome({ title, right }: { title: ReactNode; right?: ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 12px',
      borderBottom: '1px solid var(--mx-border-default)',
      background: '#111',
      fontFamily: 'var(--mx-font-mono)',
      fontSize: 11,
      color: 'var(--mx-text-secondary)',
    }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }} />
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{title}</div>
      {right ? <div style={{ flexShrink: 0 }}>{right}</div> : null}
    </div>
  );
}
