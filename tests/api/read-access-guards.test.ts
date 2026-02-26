import { beforeEach, describe, expect, it } from "vitest"
import { GET as ordersGet } from "@/app/api/orders/route"
import { GET as tablesGet } from "@/app/api/tables/route"
import { GET as tagsGet } from "@/app/api/tags/route"
import {
  assignTag,
  createOrResumeSession,
  listTables,
  registerTagScan,
  resetRuntimeStateForTests,
  submitOrder,
} from "@/lib/runtimeStore"

function seedSessionOrder() {
  const table = listTables()[0]
  registerTagScan("guard-tag")
  assignTag("guard-tag", table.id)
  const session = createOrResumeSession({
    origin: "CUSTOMER",
    tagId: "guard-tag",
  })

  submitOrder({
    sessionId: session.id,
    tagId: "guard-tag",
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

  return { table, session }
}

describe("read access guards", () => {
  beforeEach(() => {
    resetRuntimeStateForTests()
    process.env.WAITER_PASSCODES = "1111"
    process.env.KITCHEN_PASSCODES = "2222"
    process.env.BAR_PASSCODES = "3333"
    process.env.MANAGER_PASSCODES = "4444"
    process.env.ADMIN_PASSCODES = "9999"
    process.env.STAFF_AUTH_SECRET = "changeme"
    ;(process.env as Record<string, string | undefined>).NODE_ENV =
      "test"
  })

  it("requires staff auth for table list", async () => {
    const res = await tablesGet(
      new Request("http://localhost/api/tables")
    )
    expect(res.status).toBe(401)
  })

  it("returns redacted table detail to unauthenticated callers", async () => {
    const table = listTables()[0]
    const res = await tablesGet(
      new Request(
        `http://localhost/api/tables?tableId=${table.id}`
      )
    )
    expect(res.status).toBe(200)

    const payload = (await res.json()) as Record<string, unknown>
    expect(payload.id).toBe(table.id)
    expect(payload).not.toHaveProperty("billTotal")
    expect(payload).not.toHaveProperty("paidTotal")
    expect(payload).not.toHaveProperty("splitCount")
  })

  it("requires staff auth for tag list", async () => {
    const guestRes = await tagsGet(
      new Request("http://localhost/api/tags")
    )
    expect(guestRes.status).toBe(401)

    const staffRes = await tagsGet(
      new Request("http://localhost/api/tags", {
        headers: {
          "x-staff-auth": "1111",
        },
      })
    )
    expect(staffRes.status).toBe(200)
  })

  it("requires matching session header or staff for session progress", async () => {
    const { session } = seedSessionOrder()

    const guestRes = await ordersGet(
      new Request(
        `http://localhost/api/orders?view=session&sessionId=${session.id}`
      )
    )
    expect(guestRes.status).toBe(401)

    const customerRes = await ordersGet(
      new Request(
        `http://localhost/api/orders?view=session&sessionId=${session.id}`,
        {
          headers: {
            "x-session-id": session.id,
          },
        }
      )
    )
    expect(customerRes.status).toBe(200)

    const customerPayload = (await customerRes.json()) as unknown[]
    expect(customerPayload.length).toBeGreaterThan(0)

    const staffRes = await ordersGet(
      new Request(
        `http://localhost/api/orders?view=session&sessionId=${session.id}`,
        {
          headers: {
            "x-staff-auth": "1111",
          },
        }
      )
    )
    expect(staffRes.status).toBe(200)
  })

  it("requires staff auth for table review view", async () => {
    const table = listTables()[0]

    const guestRes = await ordersGet(
      new Request(
        `http://localhost/api/orders?tableNumber=${table.number}`
      )
    )
    expect(guestRes.status).toBe(401)

    const staffRes = await ordersGet(
      new Request(
        `http://localhost/api/orders?tableNumber=${table.number}`,
        {
          headers: {
            "x-staff-auth": "1111",
          },
        }
      )
    )
    expect(staffRes.status).toBe(200)
  })
})
