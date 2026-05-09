import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useMissionStore } from '@/stores/missionStore'

export interface MissionCreateFormInput {
  name: string
  goal?: string
  constraints?: string
  acceptance?: string
}

export interface MissionCreateValidationErrors {
  name?: string
}

export function validateMissionCreateInput(input: Pick<MissionCreateFormInput, 'name'>): MissionCreateValidationErrors {
  const name = input.name.trim()
  if (!name) return { name: 'Mission name is required.' }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
    return { name: 'Use letters, numbers, dots, underscores, or hyphens. Start with a letter or number.' }
  }
  return {}
}

export function buildMissionCreatePayload(input: MissionCreateFormInput): Required<MissionCreateFormInput> {
  return {
    name: input.name.trim(),
    goal: (input.goal || '').trim(),
    constraints: (input.constraints || '').trim(),
    acceptance: (input.acceptance || '').trim(),
  }
}

interface MissionCreateDialogProps {
  isOpen: boolean
  onClose: () => void
}

const EMPTY_FORM: MissionCreateFormInput = {
  name: '',
  goal: '',
  constraints: '',
  acceptance: '',
}

export function MissionCreateDialog({ isOpen, onClose }: MissionCreateDialogProps) {
  const createMission = useMissionStore((s) => s.createMission)
  const isLoading = useMissionStore((s) => s.isLoading)
  const storeError = useMissionStore((s) => s.error)
  const [form, setForm] = useState<MissionCreateFormInput>(EMPTY_FORM)
  const [touchedName, setTouchedName] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setForm(EMPTY_FORM)
    setTouchedName(false)
    setSubmitAttempted(false)
    setSubmitError('')
  }, [isOpen])

  const validation = useMemo(() => validateMissionCreateInput(form), [form])
  const showNameError = (touchedName || submitAttempted) && validation.name
  const canSubmit = !validation.name && !isLoading

  if (!isOpen) return null

  const setField = (field: keyof MissionCreateFormInput, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    if (submitError) setSubmitError('')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitAttempted(true)
    if (validation.name) return

    const ok = await createMission(buildMissionCreatePayload(form))
    if (ok) {
      onClose()
      return
    }
    setSubmitError(useMissionStore.getState().error || storeError || 'Unable to create Mission.')
  }

  return (
    <div className="dialog-overlay" onClick={(event) => { if (event.target === event.currentTarget && !isLoading) onClose() }}>
      <div className="add-pane-dialog mission-create-dialog">
        <div className="apd-header">
          <h2 className="apd-title">New Mission</h2>
          <button type="button" onClick={onClose} className="apd-close-btn" disabled={isLoading} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form className="apd-form" onSubmit={handleSubmit}>
          <div className="apd-section">
            <label className="apd-label" htmlFor="mission-create-name">Mission name</label>
            <input
              id="mission-create-name"
              className="apd-input"
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              onBlur={() => setTouchedName(true)}
              placeholder="hub-agent-team-mission-mvp"
              autoFocus
              aria-invalid={Boolean(showNameError)}
              aria-describedby={showNameError ? 'mission-create-name-error' : undefined}
            />
            {showNameError && (
              <div id="mission-create-name-error" className="mission-form-error">{validation.name}</div>
            )}
          </div>

          <div className="apd-section">
            <label className="apd-label" htmlFor="mission-create-goal">Goal</label>
            <textarea
              id="mission-create-goal"
              className="apd-input mission-create-textarea"
              value={form.goal}
              onChange={(event) => setField('goal', event.target.value)}
              placeholder="What should this Mission accomplish?"
              rows={4}
            />
          </div>

          <div className="apd-section">
            <label className="apd-label" htmlFor="mission-create-constraints">Constraints</label>
            <textarea
              id="mission-create-constraints"
              className="apd-input mission-create-textarea"
              value={form.constraints}
              onChange={(event) => setField('constraints', event.target.value)}
              placeholder="Boundaries, non-goals, sequencing, or safety constraints"
              rows={3}
            />
          </div>

          <div className="apd-section">
            <label className="apd-label" htmlFor="mission-create-acceptance">Acceptance</label>
            <textarea
              id="mission-create-acceptance"
              className="apd-input mission-create-textarea"
              value={form.acceptance}
              onChange={(event) => setField('acceptance', event.target.value)}
              placeholder="Observable completion criteria"
              rows={3}
            />
          </div>

          {submitError && <div className="mission-form-error mission-form-error--panel">{submitError}</div>}

          <div className="apd-actions">
            <button type="button" className="apd-btn apd-btn-secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="apd-btn apd-btn-primary" disabled={!canSubmit}>
              {isLoading ? 'Creating...' : 'Create Mission'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
