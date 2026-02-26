import { beforeEach, describe, expect, it } from "vitest"
import { GET as menuGet, PATCH as menuPatch } from "@/app/api/menu/route"
import {
  assignTag,
  createOrResumeSession,
  listTables,
  registerTagScan,
  resetRuntimeStateForTests,
  submitOrder,
} from "@/lib/runtimeStore"

describe("admin menu controls", () => {
  beforeEach(() => {
    resetRuntimeStateForTests()
    process.env.WAITER_PASSCODES = "1111"
    process.env.KITCHEN_PASSCODES = "2222"
    process.env.BAR_PASSCODES = "3333"
    process.env.MANAGER_PASSCODES = "4444"
    process.env.ADMIN_PASSCODES = "9999"
    process.env.STAFF_AUTH_SECRET = "changeme"
  })

  it("requires admin for full menu view", async () => {
    const guestReq = new Request("http://localhost/api/menu?view=all")
    const guestRes = await menuGet(guestReq)
    expect(guestRes.status).toBe(401)

    const adminReq = new Request("http://localhost/api/menu?view=all", {
      headers: {
        "x-staff-auth": "9999",
      },
    })
    const adminRes = await menuGet(adminReq)
    expect(adminRes.status).toBe(200)
  })

  it("can hide an item from public menu and block ordering, then reset", async () => {
    const hideReq = new Request("http://localhost/api/menu", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-staff-auth": "9999",
      },
      body: JSON.stringify({
        action: "UPDATE_ITEM",
        itemId: "espresso",
        active: false,
      }),
    })
    const hideRes = await menuPatch(hideReq)
    expect(hideRes.status).toBe(200)

    const publicRes = await menuGet(new Request("http://localhost/api/menu"))
    expect(publicRes.status).toBe(200)
    const publicPayload = (await publicRes.json()) as {
      menu: { id: string; items: { id: string }[] }[]
    }

    const hasEspressoInPublic = publicPayload.menu.some(section =>
      section.items.some(item => item.id === "espresso")
    )
    expect(hasEspressoInPublic).toBe(false)

    const table = listTables()[0]
    registerTagScan("menu-control-tag")
    assignTag("menu-control-tag", table.id)
    const session = createOrResumeSession({
      origin: "CUSTOMER",
      tagId: "menu-control-tag",
    })

    expect(() =>
      submitOrder({
        sessionId: session.id,
        tagId: "menu-control-tag",
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
    ).toThrow("Item unavailable: Espresso")

    const resetReq = new Request("http://localhost/api/menu", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-staff-auth": "9999",
      },
      body: JSON.stringify({
        action: "RESET_MENU",
      }),
    })
    const resetRes = await menuPatch(resetReq)
    expect(resetRes.status).toBe(200)

    const publicResAfterReset = await menuGet(
      new Request("http://localhost/api/menu")
    )
    const payloadAfterReset = (await publicResAfterReset.json()) as {
      menu: { id: string; items: { id: string }[] }[]
    }
    const hasEspressoAfterReset = payloadAfterReset.menu.some(section =>
      section.items.some(item => item.id === "espresso")
    )
    expect(hasEspressoAfterReset).toBe(true)
  })

  it("lets manager import a replacement menu from CSV", async () => {
    const replacementCsv = [
      "section_id,section_name,item_id,item_name,description,base_price,vat_rate,station,active,stock_count",
      "cold-drinks,Cold Drinks,sparkling-water,Sparkling Water,Cold sparkling water,2.50,0.1750,BAR,true,25",
      "hot-food,Hot Food,soup-of-day,Soup of the Day,Chef special soup,6.95,0.1750,KITCHEN,true,12",
    ].join("\n")

    const importReq = new Request("http://localhost/api/menu", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-staff-auth": "4444",
      },
      body: JSON.stringify({
        action: "IMPORT_MENU_CSV",
        csv: replacementCsv,
      }),
    })

    const importRes = await menuPatch(importReq)
    expect(importRes.status).toBe(200)

    const publicRes = await menuGet(new Request("http://localhost/api/menu"))
    const publicPayload = (await publicRes.json()) as {
      menu: { id: string; items: { id: string; name: string }[] }[]
    }

    expect(publicPayload.menu).toHaveLength(2)
    expect(
      publicPayload.menu.some(section =>
        section.items.some(item => item.id === "sparkling-water")
      )
    ).toBe(true)
    expect(
      publicPayload.menu.some(section =>
        section.items.some(item => item.id === "espresso")
      )
    ).toBe(false)
  })

  it("rejects stock delta adjustments for unlimited-stock items", async () => {
    const req = new Request("http://localhost/api/menu", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-staff-auth": "4444",
      },
      body: JSON.stringify({
        action: "ADJUST_ITEM_STOCK",
        itemId: "espresso",
        delta: -1,
      }),
    })

    const res = await menuPatch(req)
    expect(res.status).toBe(400)
    const payload = (await res.json()) as { error: string }
    expect(payload.error).toContain(
      "Cannot adjust stock for unlimited item"
    )
  })
})
