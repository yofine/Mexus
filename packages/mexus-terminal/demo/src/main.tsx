import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@xterm/xterm/css/xterm.css'
import './styles.css'

import { SingleSessionDemo } from './SingleSessionDemo'
import { StageStackDemo } from './StageStackDemo'

type DemoMode = 'single' | 'stage'

function App() {
  const [mode, setMode] = useState<DemoMode>('single')

  return (
    <main className="demo-shell">
      <nav className="demo-mode-tabs" aria-label="Terminal demo modules">
        <button
          className={mode === 'single' ? 'active' : ''}
          onClick={() => setMode('single')}
        >
          Single session
        </button>
        <button
          className={mode === 'stage' ? 'active' : ''}
          onClick={() => setMode('stage')}
        >
          Stage stack
        </button>
      </nav>
      {mode === 'single' ? <SingleSessionDemo /> : <StageStackDemo />}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
