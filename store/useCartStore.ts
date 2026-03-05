import { create } from "zustand"
import { ItemEdits, Station } from "@/lib/types"

const CART_KEY = "nfc-pos.cart.v2"

export type CartItem = {
  id: string
  name: string
  quantity: number
  unitPrice: number
  vatRate: number
  edits: ItemEdits | null
  allergens: string[]
  station: Station
}

type CartState = {
  scopeKey: string | null
  carts: Record<string, CartItem[]>
  items: CartItem[]
  setScope: (scopeKey: string) => void
  addItem: (item: CartItem) => void
  updateItem: (id: string, patch: Partial<CartItem>) => void
  removeItem: (id: string) => void
  clearItems: (ids: string[]) => void
  clearSubmittedItems: () => void
  hydrate: () => void
}

function persist(carts: Record<string, CartItem[]>) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(CART_KEY, JSON.stringify(carts))
}

function getScopedItems(
  carts: Record<string, CartItem[]>,
  scopeKey: string | null
) {
  if (!scopeKey) return []
  return carts[scopeKey] ?? []
}

export const useCartStore = create<CartState>((set, get) => ({
  scopeKey: null,
  carts: {},
  items: [],
  setScope: scopeKey =>
    set(s => ({
      scopeKey,
      items: getScopedItems(s.carts, scopeKey),
    })),
  addItem: item =>
    set(s => {
      if (!s.scopeKey) return {}
      const nextItems = [...getScopedItems(s.carts, s.scopeKey), item]
      const carts = { ...s.carts, [s.scopeKey]: nextItems }
      persist(carts)
      return { carts, items: nextItems }
    }),
  updateItem: (id, patch) =>
    set(s => {
      if (!s.scopeKey) return {}
      const nextItems = getScopedItems(s.carts, s.scopeKey).map(i =>
        i.id === id ? { ...i, ...patch } : i
      )
      const carts = { ...s.carts, [s.scopeKey]: nextItems }
      persist(carts)
      return { carts, items: nextItems }
    }),
  removeItem: id =>
    set(s => {
      if (!s.scopeKey) return {}
      const nextItems = getScopedItems(s.carts, s.scopeKey).filter(
        i => i.id !== id
      )
      const carts = { ...s.carts, [s.scopeKey]: nextItems }
      persist(carts)
      return { carts, items: nextItems }
    }),
  clearItems: ids =>
    set(s => {
      if (!s.scopeKey) return {}
      const nextItems = getScopedItems(s.carts, s.scopeKey).filter(
        i => !ids.includes(i.id)
      )
      const carts = { ...s.carts, [s.scopeKey]: nextItems }
      persist(carts)
      return { carts, items: nextItems }
    }),
  clearSubmittedItems: () =>
    set(s => {
      if (!s.scopeKey) return {}
      const carts = { ...s.carts, [s.scopeKey]: [] }
      persist(carts)
      return { carts, items: [] }
    }),
  hydrate: () => {
    if (typeof window === "undefined") return
    const raw = window.localStorage.getItem(CART_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Record<string, CartItem[]>
      const carts = parsed && typeof parsed === "object" ? parsed : {}
      set({
        carts,
        items: getScopedItems(carts, get().scopeKey),
      })
    } catch {
      set({ carts: {}, items: [] })
    }
  },
}))
