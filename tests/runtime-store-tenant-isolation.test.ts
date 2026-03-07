import { describe, expect, it } from "vitest"
import { withRestaurantContext } from "@/lib/tenantContext"
import {
  assignTag,
  createOrResumeSession,
  getMenuSnapshot,
  getShiftReport,
  listSessions,
  listTables,
  resetRuntimeState,
  submitOrder,
} from "@/lib/runtimeStore"

function createOneOrderForCurrentTenant(tagId: string) {
  const table = listTables()[0]
  if (!table) {
    throw new Error("Expected at least one table in runtime state")
  }

  assignTag(tagId, table.id)
  const session = createOrResumeSession({
    origin: "CUSTOMER",
    tagId,
  })
  const firstItem = getMenuSnapshot().menu[0]?.items[0]
  if (!firstItem) {
    throw new Error("Expected at least one menu item for order fixture")
  }

  submitOrder({
    sessionId: session.id,
    tagId,
    items: [
      {
        itemId: firstItem.id,
        name: firstItem.name,
        quantity: 1,
        edits: null,
        allergens: firstItem.allergens,
        unitPrice: firstItem.basePrice,
        vatRate: firstItem.vatRate,
        station: firstItem.station,
      },
    ],
    idempotencyKey: `tenant-order-${tagId}`,
  })
}

describe("runtimeStore tenant isolation", () => {
  it("keeps order/session state isolated per tenant slug", () => {
    withRestaurantContext("tenant-alpha", () => {
      resetRuntimeState()
      createOneOrderForCurrentTenant("alpha-tag")
      expect(listSessions().length).toBe(1)
      expect(getShiftReport().orders).toBe(1)
    })

    withRestaurantContext("tenant-beta", () => {
      resetRuntimeState()
      expect(listSessions().length).toBe(0)
      expect(getShiftReport().orders).toBe(0)
    })
  })

  it("resets only the active tenant state", () => {
    withRestaurantContext("tenant-alpha", () => {
      resetRuntimeState()
      createOneOrderForCurrentTenant("alpha-tag-2")
      expect(getShiftReport().orders).toBe(1)
    })

    withRestaurantContext("tenant-beta", () => {
      resetRuntimeState()
      createOneOrderForCurrentTenant("beta-tag-1")
      expect(getShiftReport().orders).toBe(1)
    })

    withRestaurantContext("tenant-alpha", () => {
      resetRuntimeState()
      expect(getShiftReport().orders).toBe(0)
      expect(listSessions().length).toBe(0)
    })

    withRestaurantContext("tenant-beta", () => {
      expect(getShiftReport().orders).toBe(1)
      expect(listSessions().length).toBe(1)
    })
  })
})
