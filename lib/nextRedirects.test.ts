import { describe, expect, it } from "vitest"

const nextConfig = require("../next.config.js")

describe("canonical redirects", () => {
  it("defines permanent redirects to /order routes", async () => {
    const redirects = await nextConfig.redirects()

    expect(redirects).toEqual(
      expect.arrayContaining([
        {
          source: "/t/:tagId",
          destination: "/order/t/:tagId",
          permanent: true,
        },
        {
          source: "/r/:restaurantSlug/t/:tagId",
          destination: "/order/t/:tagId?restaurantSlug=:restaurantSlug",
          permanent: true,
        },
        {
          source: "/order/r/:restaurantSlug/t/:tagId",
          destination: "/order/t/:tagId?restaurantSlug=:restaurantSlug",
          permanent: true,
        },
        {
          source: "/menu",
          destination: "/order/menu",
          permanent: true,
        },
        {
          source: "/r/:restaurantSlug/menu",
          destination: "/order/menu?restaurantSlug=:restaurantSlug",
          permanent: true,
        },
        {
          source: "/order/r/:restaurantSlug/menu",
          destination: "/order/menu?restaurantSlug=:restaurantSlug",
          permanent: true,
        },
      ])
    )
  })
})
