import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useMissionStore, type MissionSummary } from '@/stores/missionStore'
import { MissionCreateDialog } from './MissionCreateDialog'

function lifecycleLabel(mission: MissionSummary): string {
  if (mission.incomplete) return 'incomplete'
  return mission.lifecycle || 'unknown'
}

export function MissionSelector() {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
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

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 16px',
      borderBottom: '1px solid var(--border-subtle)',
      background: 'var(--bg-surface)',
      flexShrink: 0,
      minWidth: 0,
    }}>
      <select
        value={selectedMission?.name || ''}
        onChange={(event) => {
          if (event.target.value) void loadMission(event.target.value)
        }}
        disabled={isLoading || missions.length === 0}
        style={{
          minWidth: 180,
          maxWidth: 360,
          flex: '1 1 220px',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '6px 8px',
          fontSize: 'var(--font-sm)',
        }}
      >
        {missions.length === 0 && <option value="">No Missions</option>}
        {missions.map((mission) => (
          <option key={mission.name} value={mission.name}>
            {mission.name} - {lifecycleLabel(mission)}
          </option>
        ))}
      </select>

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
