// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { useCartStore } from "@/store/useCartStore"

function resetStore() {
  useCartStore.setState({
    scopeKey: null,
    carts: {},
    items: [],
  })
  window.localStorage.clear()
}

describe("useCartStore", () => {
  beforeEach(() => {
    resetStore()
  })

  it("isolates items by scope", () => {
    const state = useCartStore.getState()

    state.setScope("customer:tag-a:session-a")
    state.addItem({
      id: "item-1",
      name: "Soup",
      quantity: 1,
      unitPrice: 5,
      vatRate: 0.2,
      edits: null,
      allergens: [],
      station: "KITCHEN",
    })

    state.setScope("staff:session-1")
    expect(useCartStore.getState().items).toEqual([])

    state.addItem({
      id: "item-2",
      name: "Cola",
      quantity: 2,
      unitPrice: 3,
      vatRate: 0.2,
      edits: null,
      allergens: [],
      station: "BAR",
    })

    state.setScope("customer:tag-a:session-a")
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].id).toBe("item-1")
  })
})
