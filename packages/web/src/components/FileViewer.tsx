import { lazy, Suspense, useState, useEffect, useMemo } from 'react'
import { ImagePreview } from './ImagePreview'
import { HtmlPreview } from './HtmlPreview'
import { CsvTable } from './CsvTable'
import { PdfPreview } from './PdfPreview'
import { JsonTree } from './JsonTree'
import { api } from '@/lib/apiBase'

interface FileViewerProps {
  filePath: string
}

const MarkdownPreview = lazy(() => import('./MarkdownPreview').then((module) => ({ default: module.MarkdownPreview })))

type FileType = 'markdown' | 'svg' | 'mermaid' | 'image' | 'html' | 'csv' | 'tsv' | 'pdf' | 'json' | 'code'

function detectFileType(filePath: string): FileType {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  if (ext === 'md' || ext === 'mdx') return 'markdown'
  if (ext === 'svg') return 'svg'
  if (ext === 'mmd' || ext === 'mermaid') return 'mermaid'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'avif'].includes(ext)) return 'image'
  if (ext === 'htm' || ext === 'html') return 'html'
  if (ext === 'csv') return 'csv'
  if (ext === 'tsv') return 'tsv'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'json') return 'json'
  return 'code'
}

// Binary types that don't need text content fetch
const BINARY_TYPES: Set<FileType> = new Set(['image', 'pdf'])

// Types that have a preview/raw toggle
const PREVIEWABLE: Set<FileType> = new Set(['markdown', 'svg', 'mermaid', 'html', 'csv', 'tsv', 'json'])

export function FileViewer({ filePath }: FileViewerProps) {
  const fileType = useMemo(() => detectFileType(filePath), [filePath])
  const isBinary = BINARY_TYPES.has(fileType)
  const hasPreview = PREVIEWABLE.has(fileType)

  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewRaw, setViewRaw] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  // Fetch text content for non-binary files
  useEffect(() => {
    if (isBinary) {
      setContent(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setViewRaw(false)

    fetch(api(`/api/file?path=${encodeURIComponent(filePath)}`))
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load file')
        return res.json()
      })
      .then((data: { content: string }) => {
        setContent(data.content)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [filePath, isBinary])

  // Render the preview content for the current file type
  const renderPreview = () => {
    if (!content) return null
    switch (fileType) {
      case 'markdown':
        return (
          <Suspense fallback={<div className="editor-tab-loading">Loading preview...</div>}>
            <MarkdownPreview content={content} />
          </Suspense>
        )
      case 'mermaid':
        return (
          <pre className="plain-code-view">{content}</pre>
        )
      case 'svg':
        return (
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', padding: 24,
              background: 'repeating-conic-gradient(var(--bg-surface) 0% 25%, transparent 0% 50%) 50% / 16px 16px',
            }}
          >
            <div
              dangerouslySetInnerHTML={{ __html: content }}
              style={{ maxWidth: '100%', maxHeight: '100%' }}
            />
          </div>
        )
      case 'html':
        return <HtmlPreview filePath={filePath} />
      case 'csv':
        return <CsvTable content={content} delimiter="," />
      case 'tsv':
        return <CsvTable content={content} delimiter={'\t'} />
      case 'json':
        return <JsonTree content={content} />
      default:
        return null
    }
  }

  // Code view (syntax highlighted or plain text with line numbers)
  const renderCode = () => {
    if (!content) return null
    return (
      <pre
        className="plain-code-view"
      >
        {content.split('\n').map((line, i) => (
          <div key={i} style={{ display: 'flex', padding: '0 12px' }}>
            <span
              style={{
                width: 40, textAlign: 'right', color: 'var(--text-muted)',
                marginRight: 12, flexShrink: 0, userSelect: 'none',
              }}
            >
              {i + 1}
            </span>
            <span style={{ whiteSpace: 'pre', overflow: 'hidden' }}>{line}</span>
          </div>
        ))}
      </pre>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Path bar */}
      <div
        style={{
          padding: '4px 12px', fontSize: 11, fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)', background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
        title={filePath}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filePath}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 8 }}>
          {hasPreview && (
            <button
              onClick={() => setViewRaw((v) => !v)}
              style={{
                background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
                fontSize: 10, padding: '1px 6px', cursor: 'pointer',
              }}
            >
              {viewRaw ? 'Preview' : 'Raw'}
            </button>
          )}
          {!isBinary && content !== null && (
            <button
              onClick={handleCopy}
              title="Copy full content"
              style={{
                background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
                fontSize: 10, padding: '1px 6px', cursor: 'pointer',
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0, background: 'var(--bg-base)' }}>
        {loading && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>Loading...</div>
        )}

        {error && (
          <div style={{ padding: 16, color: 'var(--status-error)', fontSize: 12 }}>{error}</div>
        )}

        {/* Binary previews — no text content needed */}
        {!loading && isBinary && fileType === 'image' && <ImagePreview filePath={filePath} />}
        {!loading && isBinary && fileType === 'pdf' && <PdfPreview filePath={filePath} />}

        {/* Text-based previews */}
        {content !== null && !loading && hasPreview && !viewRaw && renderPreview()}

        {/* Code / raw view */}
        {content !== null && !loading && (!hasPreview || viewRaw) && renderCode()}
      </div>
    </div>
  )
}
