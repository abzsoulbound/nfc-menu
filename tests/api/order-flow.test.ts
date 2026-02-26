import { beforeEach, describe, expect, it } from "vitest"
import {
  assignTag,
  createOrResumeSession,
  getStationQueue,
  listTables,
  markStationSent,
  registerTagScan,
  resetRuntimeStateForTests,
  submitOrder,
} from "@/lib/runtimeStore"

describe("order flow", () => {
  beforeEach(() => {
    resetRuntimeStateForTests()
  })

  it("creates station queue entries and marks them sent", () => {
    const table = listTables()[0]
    registerTagScan("tag-1")
    assignTag("tag-1", table.id)

    const session = createOrResumeSession({
      origin: "CUSTOMER",
      tagId: "tag-1",
    })

    submitOrder({
      sessionId: session.id,
      tagId: "tag-1",
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

    expect(getStationQueue("BAR")).toHaveLength(1)
    markStationSent({ tableNumber: table.number, station: "BAR" })
    expect(getStationQueue("BAR")).toHaveLength(0)
  })
})
