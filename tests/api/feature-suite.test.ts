import { beforeEach, describe, expect, it } from "vitest"
import {
  assignTag,
  createOrResumeSession,
  getCustomerCheckoutQuoteByTableNumber,
  getLoyaltyAccount,
  getMenuSnapshot,
  listTables,
  processCustomerCheckout,
  registerTagScan,
  removeMenuDaypart,
  resetRuntimeStateForTests,
  submitOrder,
  upsertMenuDaypart,
} from "@/lib/runtimeStore"

describe("feature suite", () => {
  beforeEach(() => {
    resetRuntimeStateForTests()
  })

  it("handles pay-at-table checkout with promo and loyalty earning", () => {
    const table = listTables()[0]
    registerTagScan("tag-checkout")
    assignTag("tag-checkout", table.id)
    const session = createOrResumeSession({
      origin: "CUSTOMER",
      tagId: "tag-checkout",
    })

    submitOrder({
      sessionId: session.id,
      tagId: "tag-checkout",
      items: [
        {
          itemId: "signature-grill-wagyu-ribeye-200g",
          name: "Signature Grill",
          quantity: 1,
          edits: null,
          allergens: [],
          unitPrice: 34,
          vatRate: 0.175,
          station: "KITCHEN",
        },
      ],
    })

    const quote = getCustomerCheckoutQuoteByTableNumber(table.number)
    expect(quote.dueTotal).toBeGreaterThan(0)

    const checkout = processCustomerCheckout({
      tableNumber: table.number,
      shareCount: 1,
      amount: quote.dueTotal,
      tipPercent: 10,
      method: "CARD",
      promoCode: "WELCOME10",
      customerId: "email:test@example.com",
    })

    expect(checkout.receipt.totalCharged).toBeGreaterThan(0)
    expect(checkout.promoDiscount).toBeGreaterThan(0)
    expect(getLoyaltyAccount("email:test@example.com")?.points ?? 0).toBeGreaterThan(0)
  })

  it("applies daypart filters to customer menu", () => {
    const today = new Date().getDay()
    const created = upsertMenuDaypart({
      name: "Mains only",
      enabled: true,
      days: [today],
      startTime: "00:00",
      endTime: "23:59",
      sectionIds: ["mains"],
      itemIds: [],
    })

    const filtered = getMenuSnapshot().menu
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every(section => section.id === "mains")).toBe(true)

    removeMenuDaypart(created.id)
    const restored = getMenuSnapshot().menu
    expect(restored.length).toBeGreaterThan(1)
  })
})
