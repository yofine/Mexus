import type { MockFile } from '../mocks/types';
import { ChevronDown, ChevronRight, Icon } from './primitives';

export function FilesPanel({ files }: { files: MockFile[] }) {
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
        {files.map((f, i) => (
          <div
            key={i}
            className={`mx-file-row ${f.isDir ? 'mx-file-row--dir' : 'mx-file-row--file'}`}
            style={{ paddingLeft: f.depth * 12 + 2 }}
          >
            <span className="mx-file-row__chev">
              {f.isDir ? <ChevronRight size={10} /> : null}
            </span>
            <span className="mx-file-row__icon" style={{ color: f.isDir ? 'var(--mx-text-secondary)' : 'var(--mx-text-muted)' }}>
              <Icon name={f.isDir ? 'folder' : 'file'} size={12} strokeWidth={1.6} />
            </span>
            {f.mark && (
              <span style={{
                width: 12, textAlign: 'center',
                color: f.mark === 'A' ? 'var(--mx-status-running)'
                  : f.mark === 'M' ? 'var(--mx-status-waiting)'
                  : 'var(--mx-status-error)',
                fontFamily: 'var(--mx-font-mono)', fontSize: 10, fontWeight: 700,
              }}>
                {f.mark}
              </span>
            )}
            <span className="mx-file-row__name">{f.name}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

// Sole export of ChevronDown so callers keep a stable import surface.
export { ChevronDown };
