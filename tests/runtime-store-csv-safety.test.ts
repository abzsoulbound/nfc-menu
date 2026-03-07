import { beforeEach, describe, expect, it } from "vitest"
import {
  assignTag,
  createOrResumeSession,
  exportOrdersCsv,
  listTables,
  registerTagScan,
  resetRuntimeStateForTests,
  submitOrder,
} from "@/lib/runtimeStore"

describe("runtime csv export safety", () => {
  beforeEach(() => {
    resetRuntimeStateForTests()
  })

  it("neutralizes spreadsheet formulas in exported cells", () => {
    const table = listTables()[0]
    registerTagScan("csv-safe-tag")
    assignTag("csv-safe-tag", table.id)
    const session = createOrResumeSession({
      origin: "CUSTOMER",
      tagId: "csv-safe-tag",
    })

    submitOrder({
      sessionId: session.id,
      tagId: "csv-safe-tag",
      items: [
        {
          itemId: "item-formula",
          name: "=2+2",
          quantity: 1,
          edits: null,
          allergens: [],
          unitPrice: 1.5,
          vatRate: 0.2,
          station: "KITCHEN",
        },
      ],
    })

    const csv = exportOrdersCsv()
    expect(csv).toContain("'=2+2")
    expect(csv).not.toContain(",=2+2,")
  })
})
