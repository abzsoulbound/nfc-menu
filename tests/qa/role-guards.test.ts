import { beforeEach, describe, expect, it } from "vitest"
import { POST as staffPost } from "@/app/api/staff/route"
import {
  assignTag,
  createOrResumeSession,
  getMenuSnapshot,
  listTables,
  registerTagScan,
  resetRuntimeStateForTests,
  submitOrder,
} from "@/lib/runtimeStore"

describe("staff route role guards", () => {
  beforeEach(() => {
    resetRuntimeStateForTests()
    process.env.WAITER_PASSCODES = "1111"
    process.env.MANAGER_PASSCODES = "2222"
    process.env.ADMIN_PASSCODES = "3333"
    process.env.BAR_PASSCODES = "4444"
    process.env.KITCHEN_PASSCODES = "5555"
    process.env.STAFF_AUTH_SECRET = "changeme"
  })

  it("allows waiter access to table actions on /api/staff POST", async () => {
    const table = listTables()[0]
    const req = new Request("http://localhost/api/staff", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-staff-auth": "1111",
      },
      body: JSON.stringify({
        action: "LOCK_TABLE",
        tableId: table.id,
      }),
    })

    const res = await staffPost(req)
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.locked).toBe(true)
  })

  it("rejects missing staff auth for /api/staff POST", async () => {
    const table = listTables()[0]
    const req = new Request("http://localhost/api/staff", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: "LOCK_TABLE",
        tableId: table.id,
      }),
    })

    const res = await staffPost(req)
    expect(res.status).toBe(401)
  })

  it("rejects waiter trying to lock all service globally", async () => {
    const req = new Request("http://localhost/api/staff", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-staff-auth": "1111",
      },
      body: JSON.stringify({
        action: "SERVICE_LOCK",
      }),
    })

    const res = await staffPost(req)
    expect(res.status).toBe(401)
  })

  it("allows manager to lock service and blocks customer submits", async () => {
    const lockReq = new Request("http://localhost/api/staff", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-staff-auth": "2222",
      },
      body: JSON.stringify({
        action: "SERVICE_LOCK",
      }),
    })

    const lockRes = await staffPost(lockReq)
    expect(lockRes.status).toBe(200)
    expect(getMenuSnapshot().locked).toBe(true)

    const table = listTables()[0]
    registerTagScan("guard-tag-1")
    assignTag("guard-tag-1", table.id)
    const session = createOrResumeSession({
      origin: "CUSTOMER",
      tagId: "guard-tag-1",
    })

    expect(() =>
      submitOrder({
        sessionId: session.id,
        tagId: "guard-tag-1",
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
    ).toThrow("Service is temporarily locked")
  })

  it("allows waiter to merge one table into another", async () => {
    const tableList = listTables()
    const source = tableList[0]
    const target = tableList[1]

    const req = new Request("http://localhost/api/staff", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-staff-auth": "1111",
      },
      body: JSON.stringify({
        action: "MERGE_TABLE",
        sourceTableId: source.id,
        targetTableId: target.id,
      }),
    })

    const res = await staffPost(req)
    expect(res.status).toBe(200)
  })

  it("allows admin to reset runtime state", async () => {
    const table = listTables()[0]
    registerTagScan("guard-tag-2")
    assignTag("guard-tag-2", table.id)

    const resetReq = new Request("http://localhost/api/staff", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-staff-auth": "3333",
      },
      body: JSON.stringify({
        action: "RESET_RUNTIME",
      }),
    })

    const resetRes = await staffPost(resetReq)
    expect(resetRes.status).toBe(200)
    expect(
      listTables().every(current => current.closed === false)
    ).toBe(true)
  })
})
