import { useEffect } from 'react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { ClientEvent } from '@/types'

interface UseKeyboardShortcutsOptions {
  send: (event: ClientEvent) => void
  onToggleCommandPalette: () => void
  onAddPane: () => void
  onOpenSettings: () => void
}

function switchPaneByIndex(index: number) {
  const { panes, setActivePaneId } = useWorkspaceStore.getState()
  const pane = panes[index]
  if (pane) {
    setActivePaneId(pane.id)
  }
}

function switchPaneByOffset(offset: 1 | -1) {
  const { panes, activePaneId, setActivePaneId } = useWorkspaceStore.getState()
  if (panes.length === 0) return

  const currentIndex = panes.findIndex((pane) => pane.id === activePaneId)
  const nextIndex =
    currentIndex === -1
      ? offset > 0
        ? 0
        : panes.length - 1
      : (currentIndex + offset + panes.length) % panes.length

  setActivePaneId(panes[nextIndex].id)
}

export function useKeyboardShortcuts({
  send,
  onToggleCommandPalette,
  onAddPane,
  onOpenSettings,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      // Don't intercept when typing in inputs (except cmdk)
      const target = e.target as HTMLElement
      const inInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        Boolean(target.closest('[contenteditable="true"]'))
      const inTerminal = target.closest('.xterm')
      const paneIndexKey =
        e.key >= '1' && e.key <= '9'
          ? parseInt(e.key, 10) - 1
          : e.code.startsWith('Digit') && e.code.length === 6
            ? parseInt(e.code.slice(5), 10) - 1
            : -1

      // Cmd/Ctrl+K — command palette (always works)
      if (mod && e.key === 'k') {
        e.preventDefault()
        onToggleCommandPalette()
        return
      }

      // Cmd/Ctrl+, — settings (always works)
      if (mod && e.key === ',') {
        e.preventDefault()
        onOpenSettings()
        return
      }

      // Cmd/Ctrl+1-9 — switch pane by index, even when the terminal has focus
      if (mod && !inInput && paneIndexKey >= 0 && paneIndexKey <= 8) {
        e.preventDefault()
        switchPaneByIndex(paneIndexKey)
        return
      }

      // Cmd/Ctrl+[ / ] — previous / next pane, even when the terminal has focus
      if (mod && !inInput && (e.key === '[' || e.code === 'BracketLeft')) {
        e.preventDefault()
        switchPaneByOffset(-1)
        return
      }
      if (mod && !inInput && (e.key === ']' || e.code === 'BracketRight')) {
        e.preventDefault()
        switchPaneByOffset(1)
        return
      }

      // Skip remaining shortcuts if in terminal or input
      if (inTerminal || inInput) return

      // Cmd/Ctrl+N — new pane
      if (mod && e.key === 'n') {
        e.preventDefault()
        onAddPane()
        return
      }

      // Cmd/Ctrl+W — close active pane
      if (mod && e.key === 'w') {
        e.preventDefault()
        const { activePaneId } = useWorkspaceStore.getState()
        if (activePaneId) {
          send({ type: 'pane.close', paneId: activePaneId })
        }
        return
      }

      // Cmd/Ctrl+G — open git diff tab
      if (mod && e.key === 'g') {
        e.preventDefault()
        const { openReviewTab } = useWorkspaceStore.getState()
        openReviewTab()
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [send, onToggleCommandPalette, onAddPane, onOpenSettings])
}
