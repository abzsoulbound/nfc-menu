import { beforeEach, describe, expect, it } from "vitest"
import {
  assignTag,
  createOrResumeSession,
  getMenuSnapshot,
  getReadyQueue,
  getStationQueue,
  getTableReview,
  listTables,
  markStationSent,
  markTableDelivered,
  registerTagScan,
  resetRuntimeStateForTests,
  runTableAction,
  submitOrder,
} from "@/lib/runtimeStore"
import { OrderSubmissionItemDTO } from "@/lib/types"

function buildItem(
  itemId: string,
  name: string,
  station: "BAR" | "KITCHEN",
  quantity = 1
): OrderSubmissionItemDTO {
  return {
    itemId,
    name,
    quantity,
    edits: null,
    allergens: [],
    unitPrice: station === "BAR" ? 2.95 : 12.5,
    vatRate: 0.175,
    station,
  }
}

function menuItemName(itemId: string) {
  const menu = getMenuSnapshot({ includeInactive: true }).menu
  for (const section of menu) {
    for (const item of section.items) {
      if (item.id === itemId) {
        return item.name
      }
    }
  }
  return itemId
}

describe("route-flow QA coverage", () => {
  beforeEach(() => {
    resetRuntimeStateForTests()
  })

  it("keeps /menu seed available and unlocked by default", () => {
    const snapshot = getMenuSnapshot()
    expect(snapshot.menu.length).toBeGreaterThan(0)
    expect(snapshot.locked).toBe(false)
  })

  it("supports end-to-end dine-in lifecycle (/order/[tagId] to waiter delivery)", () => {
    const table = listTables()[0]
    registerTagScan("tag-101")
    assignTag("tag-101", table.id)

    const session = createOrResumeSession({
      origin: "CUSTOMER",
      tagId: "tag-101",
    })

    submitOrder({
      sessionId: session.id,
      tagId: "tag-101",
      items: [
        buildItem("espresso", "Espresso", "BAR", 1),
        buildItem("shakshuka", "Shakshuka", "KITCHEN", 2),
      ],
    })

    expect(getStationQueue("BAR")).toHaveLength(1)
    expect(getStationQueue("KITCHEN")).toHaveLength(1)

    markStationSent({ tableNumber: table.number, station: "BAR" })
    markStationSent({ tableNumber: table.number, station: "KITCHEN" })
    expect(getReadyQueue()).toHaveLength(2)

    markTableDelivered(table.number)
    expect(getReadyQueue()).toHaveLength(0)
  })

  it("groups /order/[id]/review into initial + add-on chronology", async () => {
    const expectedEspressoName = menuItemName("espresso")
    const expectedKitchenName = menuItemName("shakshuka")

    const table = listTables()[1]
    registerTagScan("tag-202")
    assignTag("tag-202", table.id)

    const firstSession = createOrResumeSession({
      origin: "CUSTOMER",
      tagId: "tag-202",
    })
    submitOrder({
      sessionId: firstSession.id,
      tagId: "tag-202",
      items: [buildItem("espresso", "Espresso", "BAR", 1)],
    })

    await new Promise(resolve => setTimeout(resolve, 5))

    const secondSession = createOrResumeSession({
      origin: "CUSTOMER",
      tagId: "tag-202",
    })
    submitOrder({
      sessionId: secondSession.id,
      tagId: "tag-202",
      items: [buildItem("shakshuka", "Shakshuka", "KITCHEN", 1)],
    })

    const review = getTableReview(table.number)
    expect(review.initialOrders).toHaveLength(1)
    expect(review.addonOrders).toHaveLength(1)
    expect(review.initialOrders[0].items[0].name).toBe(expectedEspressoName)
    expect(review.addonOrders[0].items[0].name).toBe(expectedKitchenName)
  })

  it("supports takeaway order queue and delivery flow (/order/takeaway)", () => {
    const takeawaySession = createOrResumeSession({
      origin: "CUSTOMER",
      tagId: "takeaway",
    })

    submitOrder({
      sessionId: takeawaySession.id,
      tagId: "takeaway",
      items: [buildItem("espresso", "Espresso", "BAR", 1)],
    })

    const barQueue = getStationQueue("BAR")
    expect(barQueue).toHaveLength(1)
    expect(barQueue[0].tableNumber).toBe(0)

    markStationSent({ tableNumber: 0, station: "BAR" })
    expect(getReadyQueue().some(item => item.tableNumber === 0)).toBe(true)

    markTableDelivered(0)
    expect(getReadyQueue().some(item => item.tableNumber === 0)).toBe(false)
  })

  it("rejects ordering when table is locked/closed (/order/[tagId] closed-state handling)", () => {
    const table = listTables()[2]
    registerTagScan("tag-303")
    assignTag("tag-303", table.id)

    const session = createOrResumeSession({
      origin: "CUSTOMER",
      tagId: "tag-303",
    })

    runTableAction({
      action: "LOCK_TABLE",
      tableId: table.id,
    })

    expect(() =>
      submitOrder({
        sessionId: session.id,
        tagId: "tag-303",
        items: [buildItem("shakshuka", "Shakshuka", "KITCHEN", 1)],
      })
    ).toThrow("Table is not accepting new orders")

    runTableAction({
      action: "CLOSE_PAID",
      tableId: table.id,
    })

    expect(() =>
      submitOrder({
        sessionId: session.id,
        tagId: "tag-303",
        items: [buildItem("espresso", "Espresso", "BAR", 1)],
      })
    ).toThrow("Table is not accepting new orders")
  })
})
