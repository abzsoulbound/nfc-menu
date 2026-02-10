import { create } from "zustand"

const CART_KEY = "nfc-pos.cart.v1"

type CartItem = {
  id: string
  name: string
  quantity: number
  unitPrice: number
  edits: any
  allergens: string[]
  station: "KITCHEN" | "BAR"
}

type CartState = {
  items: CartItem[]
  addItem: (item: CartItem) => void
  updateItem: (id: string, patch: Partial<CartItem>) => void
  removeItem: (id: string) => void
  clearItems: (ids: string[]) => void
  clearSubmittedItems: () => void
  hydrate: () => void
}

function persist(items: CartItem[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(CART_KEY, JSON.stringify(items))
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  addItem: item =>
    set(s => {
      const items = [...s.items, item]
      persist(items)
      return { items }
    }),
  updateItem: (id, patch) =>
    set(s => {
      const items = s.items.map(i =>
        i.id === id ? { ...i, ...patch } : i
      )
      persist(items)
      return { items }
    }),
  removeItem: id =>
    set(s => {
      const items = s.items.filter(i => i.id !== id)
      persist(items)
      return { items }
    }),
  clearItems: ids =>
    set(s => {
      const items = s.items.filter(i => !ids.includes(i.id))
      persist(items)
      return { items }
    }),
  clearSubmittedItems: () =>
    set(() => {
      persist([])
      return { items: [] }
    }),
  hydrate: () => {
    if (typeof window === "undefined") return
    const raw = window.localStorage.getItem(CART_KEY)
    if (!raw) return
    try {
      const items = JSON.parse(raw) as CartItem[]
      set({ items: Array.isArray(items) ? items : [] })
    } catch {
      set({ items: [] })
    }
  },
}))
