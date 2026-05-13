import { Check, ChevronDown, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useMissionStore, type MissionSummary } from '@/stores/missionStore'
import { MissionCreateDialog } from './MissionCreateDialog'

function lifecycleLabel(mission: MissionSummary): string {
  if (mission.incomplete) return 'incomplete'
  return mission.lifecycle || 'unknown'
}

export function MissionSelector() {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const missions = useMissionStore((s) => s.missions)
  const selectedMission = useMissionStore((s) => s.selectedMission)
  const activeMission = useMissionStore((s) => s.activeMission)
  const isLoading = useMissionStore((s) => s.isLoading)
  const loadMission = useMissionStore((s) => s.loadMission)
  const activateMission = useMissionStore((s) => s.activateMission)

  const handleActivate = async () => {
    if (!selectedMission || selectedMission.lifecycle === 'active') return
    const current = activeMission?.name ? ` Current active Mission "${activeMission.name}" will become inactive.` : ''
    if (!window.confirm(`Activate Mission "${selectedMission.name}"?${current}`)) return
    await activateMission(selectedMission.name)
  }

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  return (
    <div className="mission-selector">
      <div className={`mission-selector-menu ${menuOpen ? 'mission-selector-menu--open' : ''}`} ref={menuRef}>
        <button
          type="button"
          className="mission-selector-trigger"
          disabled={isLoading || missions.length === 0}
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          title={selectedMission?.name || 'No Missions'}
        >
          <span className="mission-selector-trigger__name">{selectedMission?.name || 'No Missions'}</span>
          {selectedMission && (
            <span className="mission-selector-trigger__state">{lifecycleLabel(selectedMission)}</span>
          )}
          <ChevronDown className="icon-xs" />
        </button>

        {menuOpen && (
          <div className="mission-selector-popover" role="listbox" aria-label="Mission selector">
            {missions.map((mission) => {
              const active = mission.name === selectedMission?.name
              return (
                <button
                  key={mission.name}
                  type="button"
                  className={`mission-selector-option ${active ? 'mission-selector-option--active' : ''}`}
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    void loadMission(mission.name)
                    setMenuOpen(false)
                  }}
                >
                  <span className="mission-selector-option__name">{mission.name}</span>
                  <span className="mission-selector-option__state">{lifecycleLabel(mission)}</span>
                  {active && <Check className="icon-xs" />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selectedMission && selectedMission.lifecycle !== 'active' && !selectedMission.incomplete && (
        <button className="pane-action-btn" onClick={handleActivate} disabled={isLoading} title="Activate Mission">
          Activate
        </button>
      )}

      <button className="pane-action-btn" onClick={() => setIsCreateOpen(true)} disabled={isLoading} title="New Mission">
        <Plus className="icon-xs" />
        <span>New Mission</span>
      </button>

      <MissionCreateDialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  )
}
