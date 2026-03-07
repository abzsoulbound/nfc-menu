// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest"
import { GET as restaurantGet } from "@/app/api/restaurant/route"

describe("restaurant route auth", () => {
  beforeEach(() => {
    process.env.WAITER_PASSCODES = "1111"
    process.env.BAR_PASSCODES = "3333"
    process.env.KITCHEN_PASSCODES = "2222"
    process.env.MANAGER_PASSCODES = "4444"
    process.env.ADMIN_PASSCODES = "9999"
    process.env.STAFF_AUTH_SECRET = "changeme"
    ;(process.env as Record<string, string | undefined>).NODE_ENV =
      "test"
  })

  it("rejects unauthenticated GET requests", async () => {
    const res = await restaurantGet(
      new Request("http://localhost/api/restaurant")
    )
    expect(res.status).toBe(401)
    const payload = (await res.json()) as Record<string, unknown>
    expect(payload.code).toBe("UNAUTHORIZED")
  })

  it("allows manager/admin to read restaurant settings", async () => {
    const res = await restaurantGet(
      new Request("http://localhost/api/restaurant", {
        headers: {
          "x-staff-auth": "4444",
        },
      })
    )
    expect(res.status).toBe(200)
    const payload = (await res.json()) as Record<string, unknown>
    expect(typeof payload.slug).toBe("string")
    expect(payload).toHaveProperty("payment")
    expect(payload).toHaveProperty("subscription")
  })
})
