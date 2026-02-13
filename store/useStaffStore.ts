import { create } from "zustand"

type StaffState = {
  selectedTable: string | null
  selectedTag: string | null
  selectedSession: string | null
  setSelectedTable: (id: string | null) => void
  setSelectedTag: (id: string | null) => void
  setSelectedSession: (id: string | null) => void
  hydrate: () => void
}

export const useStaffStore = create<StaffState>((set) => ({
  selectedTable: null,
  selectedTag: null,
  selectedSession: null,
  setSelectedTable: id =>
    set(() => ({ selectedTable: id })),
  setSelectedTag: id =>
    set(() => ({ selectedTag: id })),
  setSelectedSession: id =>
    set(() => ({ selectedSession: id })),
  hydrate: () => {
    // Local persistence is intentionally disabled for full online mode.
  },
}))
