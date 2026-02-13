import { create } from "zustand"

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

export const useCartStore = create<CartState>((set) => ({
  items: [],
  addItem: item =>
    set(s => {
      const items = [...s.items, item]
      return { items }
    }),
  updateItem: (id, patch) =>
    set(s => {
      const items = s.items.map(i =>
        i.id === id ? { ...i, ...patch } : i
      )
      return { items }
    }),
  removeItem: id =>
    set(s => {
      const items = s.items.filter(i => i.id !== id)
      return { items }
    }),
  clearItems: ids =>
    set(s => {
      const items = s.items.filter(i => !ids.includes(i.id))
      return { items }
    }),
  clearSubmittedItems: () =>
    set(() => ({ items: [] })),
  hydrate: () => {
    // Local persistence is intentionally disabled for full online mode.
  },
}))
