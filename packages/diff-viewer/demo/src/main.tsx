import { createRoot } from 'react-dom/client'
import { MexusDiffViewer } from '../../src'
import './styles.css'

const patch = [
  'diff --git a/packages/web/src/components/GitDiffPanel.tsx b/packages/web/src/components/GitDiffPanel.tsx',
  'index 1111111..2222222 100644',
  '--- a/packages/web/src/components/GitDiffPanel.tsx',
  '+++ b/packages/web/src/components/GitDiffPanel.tsx',
  '@@ -176,9 +176,10 @@ function DiffHunks({ hunks, file, send }) {',
  '   if (!hunks) return null',
  '',
  '-  const lines = hunks.split("\\n")',
  '-  return <LegacyDiff lines={lines} />',
  '+  return (',
  '+    <MexusDiffViewer file={file} hunks={hunks} />',
  '+  )',
  ' }',
  '@@ -350,6 +351,6 @@ interface DiffFileItemProps {',
  '   onDiscard?: (file: string) => void',
  '   isReviewed?: boolean',
  '   onToggleReviewed?: () => void',
  ' }',
].join('\n')

function DemoApp() {
  return (
    <main className="demo-shell">
      <section className="demo-panel demo-summary">
        <div className="demo-kicker">Mexus package demo</div>
        <h1>@mexus/diff-viewer</h1>
        <p>
          This wraps @pierre/diffs with Mexus theme tokens so GitDiffPanel can keep its
          file actions while delegating only the patch body rendering.
        </p>
        <div className="demo-current">
          <span>Rendered file</span>
          <strong>packages/web/src/components/GitDiffPanel.tsx</strong>
        </div>
      </section>

      <section className="demo-panel demo-diff-panel">
        <header className="demo-diff-header">
          <span>Git Diff</span>
          <small>mock patch</small>
        </header>
        <MexusDiffViewer
          file="packages/web/src/components/GitDiffPanel.tsx"
          hunks={patch}
          status="modified"
        />
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<DemoApp />)
