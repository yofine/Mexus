import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
  info: ErrorInfo | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info })
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    const { error, info } = this.state
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        padding: 24,
        background: '#1a1a1a',
        color: '#f0f0f0',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 13,
        overflow: 'auto',
        zIndex: 999999,
      }}>
        <h1 style={{ color: '#F85149', marginTop: 0, fontSize: 18 }}>Mexus crashed</h1>
        <div style={{ marginBottom: 12 }}>{error.name}: {error.message}</div>
        {error.stack && (
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#0d0d0d', padding: 12, borderRadius: 6, border: '1px solid #333' }}>
            {error.stack}
          </pre>
        )}
        {info?.componentStack && (
          <>
            <div style={{ marginTop: 16, marginBottom: 6, color: '#F0883E' }}>Component stack:</div>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#0d0d0d', padding: 12, borderRadius: 6, border: '1px solid #333' }}>
              {info.componentStack}
            </pre>
          </>
        )}
        <button
          onClick={() => location.reload()}
          style={{ marginTop: 16, padding: '8px 14px', background: 'var(--accent-primary)', color: 'var(--fg-on-accent)', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Reload
        </button>
      </div>
    )
  }
}
