import { create } from "zustand"

const UI_KEY = "nfc-pos.ui.v1"

type UIState = {
  toast: string | null
  modal: { title: string; body: string } | null
  banner: string | null
  setToast: (msg: string | null) => void
  setModal: (m: UIState["modal"]) => void
  setBanner: (msg: string | null) => void
  hydrate: () => void
}

function persist(state: {
  toast: string | null
  modal: { title: string; body: string } | null
  banner: string | null
}) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(UI_KEY, JSON.stringify(state))
}

export const useUIStore = create<UIState>((set) => ({
  toast: null,
  modal: null,
  banner: null,
  setToast: msg =>
    set(s => {
      const next = { ...s, toast: msg }
      persist(next)
      return { toast: msg }
    }),
  setModal: m =>
    set(s => {
      const next = { ...s, modal: m }
      persist(next)
      return { modal: m }
    }),
  setBanner: msg =>
    set(s => {
      const next = { ...s, banner: msg }
      persist(next)
      return { banner: msg }
    }),
  hydrate: () => {
    if (typeof window === "undefined") return
    const raw = window.localStorage.getItem(UI_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      set({
        toast: parsed.toast ?? null,
        modal: parsed.modal ?? null,
        banner: parsed.banner ?? null,
      })
    } catch {
      set({ toast: null, modal: null, banner: null })
    }
  },
}))
