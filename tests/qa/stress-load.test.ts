import { beforeEach, describe, expect, it } from "vitest"
import {
  assignTag,
  createOrResumeSession,
  getReadyQueue,
  getStationQueue,
  getTableReview,
  listTables,
  markStationSent,
  markTableDelivered,
  registerTagScan,
  resetRuntimeStateForTests,
  submitOrder,
} from "@/lib/runtimeStore"
import { OrderSubmissionItemDTO } from "@/lib/types"

function barItem(quantity = 1): OrderSubmissionItemDTO {
  return {
    itemId: "espresso",
    name: "Espresso",
    quantity,
    edits: null,
    allergens: [],
    unitPrice: 2.95,
    vatRate: 0.175,
    station: "BAR",
  }
}

function kitchenItem(quantity = 1): OrderSubmissionItemDTO {
  return {
    itemId: "shakshuka",
    name: "Shakshuka",
    quantity,
    edits: null,
    allergens: [],
    unitPrice: 12.5,
    vatRate: 0.175,
    station: "KITCHEN",
  }
}

describe("stress QA scenarios", () => {
  beforeEach(() => {
    resetRuntimeStateForTests()
  })

  it("handles heavy mixed dine-in load across multiple tables/sessions", () => {
    const tables = listTables().slice(0, 8)
    const tableTags = tables.map((table, index) => ({
      table,
      tagId: `stress-tag-${index + 1}`,
    }))

    for (const { table, tagId } of tableTags) {
      registerTagScan(tagId)
      assignTag(tagId, table.id)
    }

    const ORDERS_PER_TAG = 8
    for (const { tagId } of tableTags) {
      for (let i = 0; i < ORDERS_PER_TAG; i += 1) {
        const session = createOrResumeSession({
          origin: "CUSTOMER",
          tagId,
        })

        submitOrder({
          sessionId: session.id,
          tagId,
          items: [
            barItem((i % 3) + 1),
            kitchenItem(((i + 1) % 3) + 1),
          ],
        })
      }
    }

    expect(getStationQueue("BAR").length).toBeGreaterThan(0)
    expect(getStationQueue("KITCHEN").length).toBeGreaterThan(0)

    for (const { table } of tableTags) {
      markStationSent({
        tableNumber: table.number,
        station: "BAR",
      })
      markStationSent({
        tableNumber: table.number,
        station: "KITCHEN",
      })
    }

    expect(getReadyQueue().length).toBeGreaterThan(0)

    for (const { table } of tableTags) {
      markTableDelivered(table.number)
    }

    expect(getReadyQueue()).toHaveLength(0)
    for (const { table } of tableTags) {
      const review = getTableReview(table.number)
      expect(review.initialOrders.length).toBeGreaterThan(0)
      expect(review.initialOrders.length + review.addonOrders.length).toBe(
        ORDERS_PER_TAG
      )
    }
  })

  it("handles concurrent-style takeaway bursts without breaking station order", () => {
    const TAKEAWAY_ORDERS = 25
    for (let i = 0; i < TAKEAWAY_ORDERS; i += 1) {
      const session = createOrResumeSession({
        origin: "CUSTOMER",
        tagId: "takeaway",
      })
      submitOrder({
        sessionId: session.id,
        tagId: "takeaway",
        items: [barItem(1 + (i % 2))],
      })
    }

    const barQueue = getStationQueue("BAR")
    expect(barQueue).toHaveLength(TAKEAWAY_ORDERS)
    expect(barQueue.every(item => item.tableNumber === 0)).toBe(true)

    markStationSent({ tableNumber: 0, station: "BAR" })
    expect(getReadyQueue().every(item => item.tableNumber === 0)).toBe(true)

    markTableDelivered(0)
    expect(getReadyQueue()).toHaveLength(0)
  })
})

