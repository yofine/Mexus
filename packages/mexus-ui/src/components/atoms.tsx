import { useState, type MouseEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Icon, PaneAvatar, StatusDot } from './primitives';
import type { IconName } from './primitives';
import type {
  MockActivityCard,
  MockFile,
  MockHubInstance,
  MockKanbanCard,
  MockKanbanCol,
  MockPane,
  PaneStatus,
} from '../mocks/types';

/* ===========================================================
 * Atomic primitives for the gallery — every visual element on
 * the real Mexus UI maps to one component here.
 * =========================================================== */

/* ── Buttons ───────────────────────────────────────────────── */

export interface GhostButtonProps {
  icon?: IconName;
  children: ReactNode;
  onClick?: () => void;
}
export function GhostButton({ icon, children, onClick }: GhostButtonProps) {
  return (
    <button type="button" className="mx-ghost-btn" onClick={onClick}>
      {icon && <Icon name={icon} size={11} />}
      {children}
    </button>
  );
}

export interface AccentButtonProps {
  icon?: IconName;
  children: ReactNode;
  full?: boolean;
  onClick?: () => void;
}
export function AccentButton({ icon, children, full = true, onClick }: AccentButtonProps) {
  return (
    <button
      type="button"
      className="mx-btn-accent"
      onClick={onClick}
      style={full ? undefined : { width: 'auto', padding: '8px 14px' }}
    >
      {icon && <Icon name={icon} size={14} strokeWidth={2} />}
      {children}
    </button>
  );
}

/* ── Pills ──────────────────────────────────────────────────── */

export type PillStatus = 'Running' | 'Waiting' | 'Idle';
export function StatusPill({ status }: { status: PillStatus }) {
  const cls =
    status === 'Running' ? 'mx-pill--running' :
    status === 'Waiting' ? 'mx-pill--waiting' :
    'mx-pill--idle';
  return <span className={`mx-pill ${cls}`}>{status}</span>;
}

/* ── Tabs & subtabs ────────────────────────────────────────── */

export interface TabItemProps {
  icon?: IconName;
  label: string;
  active?: boolean;
  onClick?: () => void;
}
export function Tab({ icon, label, active, onClick }: TabItemProps) {
  return (
    <button
      type="button"
      className={`mx-tab ${active ? 'mx-tab--active' : ''}`}
      onClick={onClick}
      style={{ background: 'transparent', border: 0, cursor: 'pointer', height: '100%' }}
    >
      {icon && <Icon name={icon} size={12} />}
      {label}
    </button>
  );
}

export interface SubtabItemProps {
  icon?: IconName;
  label: string;
  active?: boolean;
  onClick?: () => void;
}
export function SubtabPill({ icon, label, active, onClick }: SubtabItemProps) {
  return (
    <button
      type="button"
      className={`mx-subtab ${active ? 'mx-subtab--active' : ''}`}
      onClick={onClick}
      style={{ background: active ? 'var(--mx-bg-elevated)' : 'transparent', border: 0, cursor: 'pointer' }}
    >
      {icon && <Icon name={icon} size={10} strokeWidth={2} />}
      {label}
    </button>
  );
}

/* ── Pane row (left rail) ──────────────────────────────────── */

export interface PaneRowProps {
  pane: MockPane;
  selected?: boolean;
  expanded?: boolean;
  assetsBase?: string;
  onClick?: () => void;
  onToggleExpand?: () => void;
  children?: ReactNode;
}
export function PaneRow({
  pane, selected, expanded, assetsBase, onClick, onToggleExpand, children,
}: PaneRowProps) {
  const handleChevClick = (e: MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    if (onToggleExpand) onToggleExpand();
    else if (onClick) onClick();
  };
  return (
    <div>
      <div
        className="mx-pane-row"
        onClick={onClick}
        style={{
          background: selected || expanded ? 'var(--mx-bg-elevated)' : 'transparent',
          cursor: 'pointer',
        }}
      >
        <span
          className="mx-pane-row__chev"
          onClick={handleChevClick}
          role="button"
          aria-label={expanded ? `Collapse ${pane.name}` : `Expand ${pane.name}`}
          style={{ cursor: 'pointer' }}
        >
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
        <PaneAvatar hue={pane.hue} agent={pane.agent} size={32} assetsBase={assetsBase} />
        <div className="mx-pane-row__main">
          <div className="mx-pane-row__name">{pane.name}</div>
          {pane.desc && <div className="mx-pane-row__desc">{pane.desc}</div>}
        </div>
        <StatusDot status={pane.status} />
      </div>
      {expanded && children && (
        <div style={{
          padding: '10px 12px 14px',
          background: 'var(--mx-bg-base)',
          borderBottom: '1px solid var(--mx-border-subtle)',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Activity card ─────────────────────────────────────────── */

export interface ActivityCardProps {
  card: MockActivityCard;
  agent?: string;
  assetsBase?: string;
  onClick?: () => void;
}
export function ActivityCard({ card, agent = 'claude', assetsBase, onClick }: ActivityCardProps) {
  return (
    <div
      className={`mx-card ${card.status === 'Running' ? 'mx-card--running' : ''}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="mx-card__head">
        <div className="mx-card__title">
          <PaneAvatar hue={card.hue} agent={agent} size={22} assetsBase={assetsBase} />
          <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{card.name}</span>
        </div>
        <StatusPill status={card.status} />
      </div>
      <div className="mx-card__meta">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="file" size={11} strokeWidth={1.6} />
          {card.files} files
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="replay" size={11} strokeWidth={1.6} />
          {card.age}
        </span>
      </div>
      <div className="mx-card__duration">{card.duration}</div>
    </div>
  );
}

/* ── Kanban ────────────────────────────────────────────────── */

export interface KanbanCardProps {
  card: MockKanbanCard;
  onClick?: () => void;
}
export function KanbanCard({ card, onClick }: KanbanCardProps) {
  return (
    <div className="mx-kanban-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="mx-kanban-card__id">
        <span>{card.id}</span>
        <Icon name="open" size={11} strokeWidth={1.6} />
      </div>
      {card.assignTo && (
        <span className="mx-kanban-card__tag">To {card.assignTo} / From {card.assignFrom}</span>
      )}
      <div className="mx-kanban-card__body">{card.title}</div>
    </div>
  );
}

export interface KanbanColumnProps {
  column: MockKanbanCol;
  onCardClick?: (card: MockKanbanCard) => void;
}
export function KanbanColumn({ column, onCardClick }: KanbanColumnProps) {
  return (
    <div className="mx-kanban-col">
      <div className="mx-kanban-col__head">
        <span className="mx-text-primary">{column.name}</span>
        <span className="mx-text-muted">{column.count}</span>
      </div>
      {column.cards.length === 0
        ? <div className="mx-kanban-empty">No matching tasks.</div>
        : column.cards.map((c) => (
            <KanbanCard key={c.id} card={c} onClick={onCardClick ? () => onCardClick(c) : undefined} />
          ))}
    </div>
  );
}

/* ── Mission selector & header (Team panel parts) ──────────── */

export interface MissionSelectorProps {
  name: string;
  state?: 'ACTIVE' | 'PAUSED';
  onClick?: () => void;
}
export function MissionSelector({ name, state = 'ACTIVE', onClick }: MissionSelectorProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%',
        padding: '8px 12px',
        borderRadius: 'var(--mx-radius-md)',
        border: '1px solid var(--mx-border-default)',
        background: 'var(--mx-bg-elevated)',
        fontFamily: 'var(--mx-font-mono)', fontSize: 12,
        color: 'var(--mx-text-primary)',
        cursor: 'pointer',
      }}
    >
      <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{name}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--mx-text-muted)' }}>
        <span style={{
          fontFamily: 'var(--mx-font-mono)', fontSize: 10, fontWeight: 700,
          letterSpacing: '.08em',
          color: state === 'ACTIVE' ? 'var(--mx-status-running)' : 'var(--mx-status-waiting)',
        }}>{state}</span>
        <ChevronDown size={11} />
      </span>
    </button>
  );
}

export interface MissionHeaderProps {
  name: string;
  date: string;
  description: string;
  state?: 'Active' | 'Paused';
}
export function MissionHeader({ name, date, description, state = 'Active' }: MissionHeaderProps) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--mx-text-primary)' }}>{name}</span>
        <span className={`mx-pill ${state === 'Active' ? 'mx-pill--running' : 'mx-pill--waiting'}`}>{state}</span>
      </div>
      <div style={{
        fontFamily: 'var(--mx-font-mono)', fontSize: 11.5,
        color: 'var(--mx-text-muted)', marginTop: 3,
      }}>{date}</div>
      <p style={{ marginTop: 8, fontSize: 12.5, color: 'var(--mx-text-secondary)', lineHeight: 1.55 }}>
        {description}
      </p>
    </div>
  );
}

/* ── File row ──────────────────────────────────────────────── */

export interface FileRowProps {
  file: MockFile;
  expanded?: boolean;
  onToggle?: () => void;
  onFileClick?: (name: string) => void;
}
export function FileRow({ file, expanded = false, onToggle, onFileClick }: FileRowProps) {
  const onClick = file.isDir
    ? onToggle
    : (onFileClick ? () => onFileClick(file.name) : undefined);
  return (
    <div
      className={`mx-file-row ${file.isDir ? 'mx-file-row--dir' : 'mx-file-row--file'}`}
      style={{ paddingLeft: file.depth * 12 + 2, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <span className="mx-file-row__chev">
        {file.isDir ? (expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />) : null}
      </span>
      <span
        className="mx-file-row__icon"
        style={{ color: file.isDir ? 'var(--mx-text-secondary)' : 'var(--mx-text-muted)' }}
      >
        <Icon name={file.isDir ? 'folder' : 'file'} size={12} strokeWidth={1.6} />
      </span>
      {file.mark && (
        <span style={{
          width: 12, textAlign: 'center',
          color: file.mark === 'A' ? 'var(--mx-status-running)'
            : file.mark === 'M' ? 'var(--mx-status-waiting)'
            : 'var(--mx-status-error)',
          fontFamily: 'var(--mx-font-mono)', fontSize: 10, fontWeight: 700,
        }}>{file.mark}</span>
      )}
      <span className="mx-file-row__name">{file.name}</span>
    </div>
  );
}

/* ── Hub instance card ─────────────────────────────────────── */

export interface HubInstanceCardProps {
  instance: MockHubInstance;
  onOpen?: () => void;
  onStop?: () => void;
  onRemove?: () => void;
}
export function HubInstanceCard({ instance, onOpen, onStop, onRemove }: HubInstanceCardProps) {
  const stop = (e: MouseEvent) => e.stopPropagation();
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
          {instance.pid !== undefined && <span className="mx-hub-pid">pid <b>{instance.pid}</b></span>}
          <span className="mx-hub-pid">started <b>{instance.uptime}</b></span>
        </div>
      </div>
      <div className="mx-hub-card__actions">
        <button className="mx-hub-action" type="button" onClick={(e) => { stop(e); onOpen?.(); }}>
          <Icon name="open" size={11} strokeWidth={1.8} /> Open
        </button>
        <button className="mx-hub-action" type="button" onClick={(e) => { stop(e); onStop?.(); }}>
          <Icon name="power" size={11} strokeWidth={1.8} /> Stop
        </button>
        <button className="mx-hub-action" type="button" onClick={(e) => { stop(e); onRemove?.(); }}>
          <Icon name="trash" size={11} strokeWidth={1.8} /> Remove
        </button>
      </div>
    </div>
  );
}

/* ── Hub create form (right rail) ──────────────────────────── */

export interface HubCreateFormProps {
  initialPath?: string;
  initialPort?: string;
  onCreate?: (values: { path: string; port: string }) => void;
}
export function HubCreateForm({ initialPath = '~/projects/my-app', initialPort = 'Auto assign', onCreate }: HubCreateFormProps) {
  // Internal state so the atom is self-contained and click→callback works
  // without poking at the DOM. The full Hub flow uses InteractiveMexus.
  return <HubCreateFormInner path={initialPath} port={initialPort} onCreate={onCreate} />;
}

function HubCreateFormInner({ path, port, onCreate }: { path: string; port: string; onCreate?: (v: { path: string; port: string }) => void }) {
  const [p, setP] = useState(path);
  const [pt, setPt] = useState(port);
  return (
    <div>
      <div className="mx-hub-section-title">Start execution server</div>
      <div className="mx-hub-section-sub">New execution server</div>
      <div style={{ marginTop: 18 }}>
        <div className="mx-form-field">
          <label className="mx-form-field__label">Project path</label>
          <input className="mx-form-field__input" value={p} onChange={(e) => setP(e.target.value)} />
        </div>
        <div className="mx-form-field">
          <label className="mx-form-field__label">Port</label>
          <input className="mx-form-field__input" value={pt} onChange={(e) => setPt(e.target.value)} />
        </div>
        <AccentButton icon="file-plus" onClick={() => onCreate?.({ path: p, port: pt })}>
          Create server
        </AccentButton>
        <div className="mx-hub-help">
          Mexus Hub owns the tabs and connection state. The Hub view keeps the current
          server connection alive; opening another running server switches the active connection.
        </div>
      </div>
    </div>
  );
}

export interface FormFieldProps {
  label: string;
  defaultValue?: string;
  name?: string;
}
export function FormField({ label, defaultValue, name }: FormFieldProps) {
  return (
    <div className="mx-form-field">
      <label className="mx-form-field__label">{label}</label>
      <input className="mx-form-field__input" defaultValue={defaultValue} name={name} />
    </div>
  );
}

/* ── Mission Agents ─────────────────────────────────────────── */

export interface MissionAgentCardProps {
  initial: string;
  name: string;
  role?: string;
  hue: number;
  toClaim: number;
  active: number;
  done: number;
  tasks: number;
  summary?: string;
  onClick?: () => void;
}
export function MissionAgentCard({
  initial, name, role = 'Mission Agent', hue, toClaim, active, done, tasks, summary, onClick,
}: MissionAgentCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        border: '1px solid var(--mx-border-default)',
        borderRadius: 'var(--mx-radius-md)',
        padding: 14,
        background: 'var(--mx-bg-elevated)',
        display: 'flex', flexDirection: 'column', gap: 10,
        cursor: onClick ? 'pointer' : 'default',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{
          display: 'inline-grid', placeItems: 'center',
          width: 28, height: 28,
          borderRadius: 'var(--mx-radius-sm)',
          background: `hsl(${hue}, 60%, 30%)`,
          color: '#fff',
          fontFamily: 'var(--mx-font-mono)',
          fontSize: 13, fontWeight: 700,
        }}>{initial}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--mx-text-primary)' }}>{name}</span>
            <span style={{ fontFamily: 'var(--mx-font-mono)', fontSize: 11, color: 'var(--mx-text-muted)' }}>{tasks} tasks</span>
          </div>
          <div style={{ fontFamily: 'var(--mx-font-mono)', fontSize: 11, color: 'var(--mx-text-muted)', marginTop: 2 }}>{role}</div>
        </div>
      </div>
      {summary && (
        <div style={{ fontSize: 12, color: 'var(--mx-text-secondary)', lineHeight: 1.55 }}>{summary}</div>
      )}
      <div style={{
        display: 'flex', gap: 14,
        fontFamily: 'var(--mx-font-mono)', fontSize: 11,
        color: 'var(--mx-text-muted)',
        borderTop: '1px solid var(--mx-border-subtle)',
        paddingTop: 8,
      }}>
        <span>{toClaim} to claim</span>
        <span>{active} active</span>
        <span>{done} done</span>
      </div>
    </div>
  );
}

/* ── Squad Lead Log ────────────────────────────────────────── */

export interface SquadLeadLogEntryProps {
  time: string;
  actor: string;
  text: string;
}
export function SquadLeadLogEntry({ time, actor, text }: SquadLeadLogEntryProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '88px 110px 1fr',
      gap: 12,
      padding: '8px 0',
      borderBottom: '1px solid var(--mx-border-subtle)',
      fontSize: 12,
    }}>
      <span style={{ fontFamily: 'var(--mx-font-mono)', color: 'var(--mx-text-muted)' }}>{time}</span>
      <span style={{ fontFamily: 'var(--mx-font-mono)', color: 'var(--mx-text-secondary)' }}>{actor}</span>
      <span style={{ color: 'var(--mx-text-primary)', lineHeight: 1.55 }}>{text}</span>
    </div>
  );
}

/* ── Status pill helper for the gallery ───────────────────── */

export function pillStatusFromPane(p: PaneStatus): PillStatus {
  switch (p) {
    case 'running': return 'Running';
    case 'waiting': return 'Waiting';
    default:        return 'Idle';
  }
}
