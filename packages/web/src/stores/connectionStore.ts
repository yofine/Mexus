import { create } from 'zustand'
import type { ConnectionTarget } from '@/types'

interface ConnectionStore {
  hubMode: boolean
  activeTarget: ConnectionTarget | null
  setHubMode: (hubMode: boolean) => void
  setActiveTarget: (target: ConnectionTarget | null) => void
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  hubMode: false,
  activeTarget: null,
  setHubMode: (hubMode) => set({ hubMode }),
  setActiveTarget: (activeTarget) => set({ activeTarget }),
}))
