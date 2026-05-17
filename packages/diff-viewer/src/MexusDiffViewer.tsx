import { useMemo } from 'react'
import { PatchDiff } from '@pierre/diffs/react'
import { createSingleFilePatch, type SingleFilePatchInput } from './patch'

export interface MexusDiffViewerProps extends SingleFilePatchInput {}

const diffUnsafeCss = `
  :host {
    color-scheme: dark;
    --mexus-diff-bg: var(--bg-base, #050505);
    --mexus-diff-panel: var(--bg-surface, #080807);
    --mexus-diff-border: var(--border-subtle, #22211f);
    --mexus-diff-border-strong: var(--border-default, #2b2925);
    --mexus-diff-fg: var(--text-code, #d4d4d4);
    --mexus-diff-fg-strong: var(--text-primary, #e7e5df);
    --mexus-diff-fg-muted: var(--text-muted, #8d887f);
    --mexus-diff-accent: var(--accent-primary, #3ccfab);
    --mexus-diff-accent-muted: var(--accent-muted, rgba(42, 184, 154, 0.12));
    --mexus-diff-add: var(--status-running, #3fb950);
    --mexus-diff-delete: var(--status-error, #d86d6d);

    --diffs-dark-bg: var(--mexus-diff-bg);
    --diffs-dark: var(--mexus-diff-fg);
    --diffs-bg-context-override: var(--mexus-diff-bg);
    --diffs-bg-context-gutter-override: #070707;
    --diffs-bg-separator-override: #0d0d0c;
    --diffs-bg-buffer-override: var(--mexus-diff-bg);
    --diffs-bg-hover-override: var(--mexus-diff-accent);
    --diffs-bg-selection-override: var(--mexus-diff-accent);
    --diffs-bg-addition-override: rgba(42, 184, 154, 0.16);
    --diffs-bg-addition-number-override: rgba(42, 184, 154, 0.10);
    --diffs-bg-deletion-override: rgba(216, 109, 109, 0.14);
    --diffs-bg-deletion-number-override: rgba(216, 109, 109, 0.09);
    --diffs-addition-color-override: var(--mexus-diff-add);
    --diffs-deletion-color-override: var(--mexus-diff-delete);
    --diffs-modified-color-override: var(--mexus-diff-accent);
    --diffs-fg-number-override: var(--mexus-diff-fg-muted);
    --diffs-scrollbar-gutter-override: 6px;
    --diffs-font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    --diffs-header-font-family: var(--font-ui, Inter, system-ui, sans-serif);
    --diffs-font-size: var(--font-xs, 11px);
    --diffs-line-height: 19px;
    --diffs-gap-block: 0px;
    background: var(--mexus-diff-bg);
    color: var(--mexus-diff-fg);
  }

  [data-diff] {
    border: 0;
    background: var(--mexus-diff-bg);
  }

  [data-diffs-header] {
    display: none;
  }

  [data-code] {
    background: var(--mexus-diff-bg);
    border-top: 1px solid var(--mexus-diff-border);
  }

  [data-line],
  [data-column-number],
  [data-gutter-buffer],
  [data-no-newline] {
    min-height: 19px;
  }

  [data-column-number],
  [data-gutter-buffer] {
    border-right: 1px solid rgba(231, 229, 223, 0.05);
  }

  [data-separator] {
    color: var(--mexus-diff-accent);
    background: #0a0a09;
    border-block: 1px solid var(--mexus-diff-border);
    font-weight: 500;
  }

`

export function MexusDiffViewer({ file, hunks, status }: MexusDiffViewerProps) {
  const patch = useMemo(() => createSingleFilePatch({ file, hunks, status }), [file, hunks, status])

  if (!patch) return null

  return (
    <div className="mexus-diff-viewer">
      <PatchDiff
        patch={patch}
        disableWorkerPool
        options={{
          disableFileHeader: true,
          diffIndicators: 'classic',
          diffStyle: 'unified',
          hunkSeparators: 'metadata',
          lineDiffType: 'word',
          maxLineDiffLength: 500,
          overflow: 'scroll',
          theme: 'github-dark',
          themeType: 'dark',
          unsafeCSS: diffUnsafeCss,
          lineHoverHighlight: 'both',
        }}
      />
    </div>
  )
}
