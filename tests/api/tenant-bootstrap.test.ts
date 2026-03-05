import { describe, expect, it } from "vitest"
import { GET } from "@/app/api/tenant/bootstrap/route"

describe("tenant bootstrap route", () => {
  it("returns tenant bootstrap payload", async () => {
    const req = new Request("http://localhost:3000/api/tenant/bootstrap")
    const res = await GET(req)
    expect(res.status).toBe(200)

    const payload = (await res.json()) as {
      restaurant: {
        slug: string
        name: string
        experienceConfig: {
          menu: {
            heroTitle: string
          }
          review: {
            title: string
          }
        }
      }
      features: {
        setupV2: boolean
      }
      permissions: Record<string, unknown>
      links: {
        entry: string
        menu: string
        staffLogin: string
      }
      availableRestaurants: Array<{
        links: {
          entry: string
        }
      }>
    }

    expect(typeof payload.restaurant.slug).toBe("string")
    expect(typeof payload.restaurant.name).toBe("string")
    expect(typeof payload.restaurant.experienceConfig.menu.heroTitle).toBe("string")
    expect(typeof payload.restaurant.experienceConfig.review.title).toBe("string")
    expect(typeof payload.features.setupV2).toBe("boolean")
    expect(typeof payload.permissions).toBe("object")
    expect(typeof payload.links.entry).toBe("string")
    expect(typeof payload.links.menu).toBe("string")
    expect(typeof payload.links.staffLogin).toBe("string")
    expect(payload.links.entry.startsWith("/r/")).toBe(true)
    expect(payload.links.menu.includes("?next=%2Fmenu")).toBe(true)
    expect(payload.links.staffLogin.includes("%2Fstaff-login")).toBe(true)
    expect(payload.availableRestaurants.length).toBeGreaterThan(0)
    expect(
      payload.availableRestaurants[0]?.links.entry.startsWith("/r/")
    ).toBe(true)
  })
})
