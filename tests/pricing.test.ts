import { describe, expect, it } from "vitest"
import { calculateCartTotals, calculateItemPrice } from "@/lib/pricing"

describe("pricing", () => {
  it("applies add-on deltas", () => {
    const price = calculateItemPrice(10, {
      addOns: [
        { name: "cheese", priceDelta: 1.5 },
        { name: "bacon", priceDelta: 2 },
      ],
    })

    expect(price).toBe(13.5)
  })

  it("treats VAT as included in item prices", () => {
    const totals = calculateCartTotals([
      { quantity: 2, unitPrice: 10, vatRate: 0.2 },
      { quantity: 1, unitPrice: 5, vatRate: 0.1 },
    ])

    expect(totals.subtotal).toBe(25)
    expect(totals.vat).toBeCloseTo(3.787878, 5)
    expect(totals.total).toBe(25)
  })
})
