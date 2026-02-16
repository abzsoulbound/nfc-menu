import { describe, expect, it } from "vitest"
import { externalOrderUrl, tenantOrderPath } from "@/lib/restaurants"

describe("restaurant order urls", () => {
  it("builds a canonical fallback link when no custom domain exists", () => {
    expect(tenantOrderPath("5")).toBe("/order/t/5")
    expect(
      externalOrderUrl({
        tableId: "5",
      })
    ).toBe("/order/t/5")
  })

  it("builds a custom-domain link without slug segment", () => {
    expect(
      externalOrderUrl({
        baseUrl: "https://acmekitchen.co.uk",
        tableId: "A-1",
      })
    ).toBe("https://acmekitchen.co.uk/t/A-1")
  })

  it("normalizes trailing slashes for domain links", () => {
    expect(
      externalOrderUrl({
        baseUrl: "https://acmekitchen.co.uk/",
        tableId: "17",
      })
    ).toBe("https://acmekitchen.co.uk/t/17")
  })
})
