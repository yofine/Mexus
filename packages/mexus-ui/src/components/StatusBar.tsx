import { Icon } from './primitives';

interface Props {
  shellLabel?: string;     // e.g. "shell 2"
  projectLabel?: string;   // e.g. "shop"
  branch?: string;         // e.g. "main"
  changes?: number;
  shells?: number;
}

export function StatusBar({
  shellLabel = 'shell 2',
  projectLabel = 'shop',
  branch = 'main',
  changes = 0,
  shells = 3,
}: Props) {
  return (
    <div className="mx-statusbar">
      <span className="mx-statusbar__chunk">
        <Icon name="terminal" size={12} />
        <span>Terminal</span>
      </span>
      <span className="mx-statusbar__chunk">
        <Icon name="shell" size={12} />
        <span>{shellLabel}</span>
      </span>
      <span style={{ color: 'var(--mx-text-muted)' }}>/</span>
      <span className="mx-statusbar__chunk">
        <Icon name="folder" size={12} />
        <span>{projectLabel}</span>
      </span>
      <span style={{ color: 'var(--mx-text-muted)' }}>/</span>
      <span className="mx-statusbar__chunk">
        <Icon name="branch" size={12} />
        <span>{branch}</span>
      </span>
      <span style={{ color: 'var(--mx-text-muted)' }}>/</span>
      <span className="mx-statusbar__chunk">
        <Icon name="changes" size={12} />
        <span>{changes} changes</span>
      </span>
      <span style={{ flex: 1 }} />
      <span style={{ color: 'var(--mx-text-muted)' }}>{shells} shells</span>
    </div>
  );
}
