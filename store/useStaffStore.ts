import { create } from "zustand"

const STAFF_KEY = "nfc-pos.staff.v1"

type StaffState = {
  selectedTable: string | null
  selectedTag: string | null
  selectedSession: string | null
  setSelectedTable: (id: string | null) => void
  setSelectedTag: (id: string | null) => void
  setSelectedSession: (id: string | null) => void
  hydrate: () => void
}

function persist(state: {
  selectedTable: string | null
  selectedTag: string | null
  selectedSession: string | null
}) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STAFF_KEY, JSON.stringify(state))
}

export const useStaffStore = create<StaffState>((set) => ({
  selectedTable: null,
  selectedTag: null,
  selectedSession: null,
  setSelectedTable: id =>
    set(s => {
      const next = { ...s, selectedTable: id }
      persist(next)
      return { selectedTable: id }
    }),
  setSelectedTag: id =>
    set(s => {
      const next = { ...s, selectedTag: id }
      persist(next)
      return { selectedTag: id }
    }),
  setSelectedSession: id =>
    set(s => {
      const next = { ...s, selectedSession: id }
      persist(next)
      return { selectedSession: id }
    }),
  hydrate: () => {
    if (typeof window === "undefined") return
    const raw = window.localStorage.getItem(STAFF_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      set({
        selectedTable: parsed.selectedTable ?? null,
        selectedTag: parsed.selectedTag ?? null,
        selectedSession: parsed.selectedSession ?? null,
      })
    } catch {
      set({
        selectedTable: null,
        selectedTag: null,
        selectedSession: null,
      })
    }
  },
}))
