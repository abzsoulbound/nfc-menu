import { create } from "zustand"

type UIState = {
  toast: string | null
  modal: { title: string; body: string } | null
  banner: string | null
  setToast: (msg: string | null) => void
  setModal: (m: UIState["modal"]) => void
  setBanner: (msg: string | null) => void
  hydrate: () => void
}

export const useUIStore = create<UIState>((set) => ({
  toast: null,
  modal: null,
  banner: null,
  setToast: msg =>
    set(() => ({ toast: msg })),
  setModal: m =>
    set(() => ({ modal: m })),
  setBanner: msg =>
    set(() => ({ banner: msg })),
  hydrate: () => {
    // Local persistence is intentionally disabled for full online mode.
  },
}))
