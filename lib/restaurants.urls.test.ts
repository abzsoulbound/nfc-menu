import { describe, expect, it } from "vitest"
import { externalOrderUrl, tenantOrderPath } from "@/lib/restaurants"

describe("restaurant order urls", () => {
  it("builds a tenant fallback link when no custom domain exists", () => {
    expect(tenantOrderPath("marlos", "5")).toBe("/order/t/5")
    expect(
      externalOrderUrl({
        restaurantSlug: "marlos",
        tableId: "5",
      })
    ).toBe("/order/t/5")
  })

  it("builds a non-default tenant fallback link when no custom domain exists", () => {
    expect(tenantOrderPath("acme", "5")).toBe(
      "/order/t/5?restaurantSlug=acme"
    )
  })

  it("builds a custom-domain link without slug segment", () => {
    expect(
      externalOrderUrl({
        baseUrl: "https://acmekitchen.co.uk",
        restaurantSlug: "acme",
        tableId: "A-1",
      })
    ).toBe("https://acmekitchen.co.uk/t/A-1")
  })

  it("normalizes trailing slashes for domain links", () => {
    expect(
      externalOrderUrl({
        baseUrl: "https://acmekitchen.co.uk/",
        restaurantSlug: "acme",
        tableId: "17",
      })
    ).toBe("https://acmekitchen.co.uk/t/17")
  })
})
