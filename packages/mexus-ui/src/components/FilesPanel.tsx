import { useState } from 'react';
import type { MockFile } from '../mocks/types';
import { Icon } from './primitives';
import { FileRow } from './atoms';

interface Props {
  files: MockFile[];
  /** Set of file names that start expanded. Defaults to all dirs expanded. */
  initialExpanded?: string[];
}

export function FilesPanel({ files, initialExpanded }: Props) {
  // Each directory tracks its own expanded state. Default to "all open" so the
  // tree mirrors the screenshot.
  const initialSet = new Set<string>(
    initialExpanded ?? files.filter((f) => f.isDir).map((f) => f.name)
  );
  const [expanded, setExpanded] = useState<Set<string>>(initialSet);

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Filter rows whose ancestor dir is collapsed. Track collapsed-depths.
  const visible: MockFile[] = [];
  let hideBelow = Infinity;
  for (const f of files) {
    if (f.depth > hideBelow) continue;
    hideBelow = Infinity;
    visible.push(f);
    if (f.isDir && !expanded.has(f.name)) hideBelow = f.depth;
  }

  return (
    <aside className="mx-files">
      <div className="mx-panel-header">
        <div className="mx-panel-header__title">
          <Icon name="folder" size={13} />
          <span>Files</span>
        </div>
        <div className="mx-panel-header__actions">
          <span style={{ display: 'inline-grid', placeItems: 'center', color: 'var(--mx-text-muted)' }}>
            <Icon name="folder-plus" size={13} />
          </span>
        </div>
      </div>

      <div className="mx-files__body">
        {visible.map((f, i) => (
          <FileRow
            key={`${f.name}-${i}`}
            file={f}
            expanded={expanded.has(f.name)}
            onToggle={() => toggle(f.name)}
          />
        ))}
      </div>
    </aside>
  );
}
