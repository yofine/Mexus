import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/globals.css'

try {
  const savedTheme = window.localStorage.getItem('nexus-theme')
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme)
  }
  const savedFont = window.localStorage.getItem('nexus-font-mono')
  if (savedFont) {
    document.documentElement.style.setProperty('--font-mono', savedFont)
  }
} catch {
  // Keep the static HTML defaults when storage is unavailable.
}

window.addEventListener('error', (event) => {
  console.error('[window.error]', event.message, event.error)
})
window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandledrejection]', event.reason)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
