// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest"
import {
  assignTag,
  createOrResumeSession,
  getCustomerCheckoutQuoteByTableNumber,
  getTableBill,
  listTables,
  processCustomerCheckout,
  registerTagScan,
  resetRuntimeStateForTests,
  submitOrder,
} from "@/lib/runtimeStore"

describe("checkout idempotency", () => {
  beforeEach(() => {
    resetRuntimeStateForTests()
  })

  it("replays the same checkout response without double charging", () => {
    const table = listTables()[0]
    registerTagScan("tag-idempotent")
    assignTag("tag-idempotent", table.id)
    const session = createOrResumeSession({
      origin: "CUSTOMER",
      tagId: "tag-idempotent",
    })

    submitOrder({
      sessionId: session.id,
      tagId: "tag-idempotent",
      items: [
        {
          itemId: "espresso",
          name: "Espresso",
          quantity: 2,
          edits: null,
          allergens: [],
          unitPrice: 2.95,
          vatRate: 0.175,
          station: "BAR",
        },
      ],
    })

    const quote = getCustomerCheckoutQuoteByTableNumber(table.number)
    const request = {
      tableNumber: table.number,
      amount: quote.dueTotal,
      tipPercent: 0,
      method: "CARD" as const,
      idempotencyKey: "checkout-abc-123",
    }

    const first = processCustomerCheckout(request)
    const second = processCustomerCheckout(request)

    expect(second.idempotencyReplay).toBe(true)
    expect(second.receipt.receiptId).toBe(first.receipt.receiptId)
    expect(second.receipt.totalCharged).toBe(first.receipt.totalCharged)

    const bill = getTableBill(table.id)
    expect(bill.entries).toHaveLength(1)
    expect(bill.dueTotal).toBe(0)
  })
})
