// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as payments from "@/lib/payments"
import { finalizeCustomerCheckout } from "@/lib/customerCheckout"
import {
  assignTag,
  createOrResumeSession,
  getTableBill,
  listTables,
  registerTagScan,
  resetRuntimeStateForTests,
  submitOrder,
} from "@/lib/runtimeStore"

describe("finalizeCustomerCheckout", () => {
  beforeEach(() => {
    resetRuntimeStateForTests()
    vi.restoreAllMocks()
  })

  it("does not mutate the table bill when provider charge fails", async () => {
    const table = listTables()[0]
    registerTagScan("tag-checkout-failure")
    assignTag("tag-checkout-failure", table.id)
    const session = createOrResumeSession({
      origin: "CUSTOMER",
      tagId: "tag-checkout-failure",
    })

    submitOrder({
      sessionId: session.id,
      tagId: "tag-checkout-failure",
      items: [
        {
          itemId: "espresso",
          name: "Espresso",
          quantity: 1,
          edits: null,
          allergens: [],
          unitPrice: 2.95,
          vatRate: 0.175,
          station: "BAR",
        },
      ],
    })

    vi.spyOn(
      payments,
      "getPaymentProviderAdapterForTenant"
    ).mockReturnValue({
      charge: vi
        .fn()
        .mockRejectedValue(new Error("Charge failed")),
    })

    await expect(
      finalizeCustomerCheckout({
        restaurantSlug: "demo",
        isDemo: true,
        checkout: {
          tableNumber: table.number,
          method: "CARD",
          idempotencyKey: "checkout-failure-test",
        },
      })
    ).rejects.toThrow("Charge failed")

    const bill = getTableBill(table.id)
    expect(bill.entries).toHaveLength(0)
    expect(bill.paidTotal).toBe(0)
    expect(bill.dueTotal).toBeGreaterThan(0)
  })
})
