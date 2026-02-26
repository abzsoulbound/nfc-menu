import { describe, expect, it } from "vitest"
import { buildCartLineId, getMenuItemIdFromCartLineId } from "@/lib/cartLine"

describe("cart line id helpers", () => {
  it("keeps plain item ids without edits", () => {
    const lineId = buildCartLineId("espresso", null)
    expect(lineId).toBe("espresso")
    expect(getMenuItemIdFromCartLineId(lineId)).toBe("espresso")
  })

  it("creates deterministic ids for equivalent edits", () => {
    const first = buildCartLineId("latte", {
      removals: ["foam", "foam"],
      swaps: [{ from: "milk", to: "oat" }],
      addOns: [{ name: "syrup", priceDelta: 0.5 }],
    })
    const second = buildCartLineId("latte", {
      addOns: [{ name: "syrup", priceDelta: 0.5 }],
      swaps: [{ from: "milk", to: "oat" }],
      removals: ["foam"],
    })

    expect(first).toBe(second)
    expect(getMenuItemIdFromCartLineId(first)).toBe("latte")
  })
})
