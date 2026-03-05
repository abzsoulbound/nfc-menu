// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest"
import {
  buildRestaurantScopedLinks,
  getDefaultRestaurantSlug,
  restaurantEntryPathForSlug,
  resolveRestaurantSlugFromRequest,
} from "@/lib/tenant"

const mutableEnv = process.env as Record<string, string | undefined>
const previousNodeEnv = mutableEnv.NODE_ENV
const previousAllowProductionOverride =
  mutableEnv.ALLOW_TENANT_OVERRIDE_IN_PRODUCTION

afterEach(() => {
  mutableEnv.NODE_ENV = previousNodeEnv
  mutableEnv.ALLOW_TENANT_OVERRIDE_IN_PRODUCTION =
    previousAllowProductionOverride
})

describe("tenant resolution", () => {
  it("resolves restaurant slug from explicit query parameter", () => {
    const request = new Request(
      "http://localhost:3000/menu?restaurant=alpha-bistro"
    )
    expect(resolveRestaurantSlugFromRequest(request)).toBe(
      "alpha-bistro"
    )
  })

  it("resolves restaurant slug from cookie when query is absent", () => {
    const request = new Request("http://localhost:3000/menu", {
      headers: {
        cookie: "restaurant_slug=beta-kitchen",
      },
    })
    expect(resolveRestaurantSlugFromRequest(request)).toBe(
      "beta-kitchen"
    )
  })

  it("falls back to configured default when no tenant hint exists", () => {
    const request = new Request("http://localhost:3000/menu")
    expect(resolveRestaurantSlugFromRequest(request)).toBe(
      getDefaultRestaurantSlug()
    )
  })

  it("ignores vercel platform hostnames as tenant hints", () => {
    const request = new Request(
      "https://fable-stores-nfc-menu.vercel.app/menu",
      {
        headers: {
          "x-forwarded-host": "fable-stores-nfc-menu.vercel.app",
        },
      }
    )
    expect(resolveRestaurantSlugFromRequest(request)).toBe(
      getDefaultRestaurantSlug()
    )
  })

  it("still resolves tenant slug from custom subdomains", () => {
    const request = new Request("https://alpha-bistro.example.com/menu", {
      headers: {
        "x-forwarded-host": "alpha-bistro.example.com",
      },
    })
    expect(resolveRestaurantSlugFromRequest(request)).toBe(
      "alpha-bistro"
    )
  })

  it("ignores query and header tenant overrides in production by default", () => {
    mutableEnv.NODE_ENV = "production"
    delete mutableEnv.ALLOW_TENANT_OVERRIDE_IN_PRODUCTION

    const request = new Request(
      "https://app.example.com/menu?restaurant=alpha-bistro",
      {
        headers: {
          "x-restaurant-slug": "bravo-bistro",
          cookie: "restaurant_slug=charlie-bistro",
        },
      }
    )
    expect(resolveRestaurantSlugFromRequest(request)).toBe(
      "charlie-bistro"
    )
  })

  it("allows production tenant override only when explicitly enabled", () => {
    mutableEnv.NODE_ENV = "production"
    mutableEnv.ALLOW_TENANT_OVERRIDE_IN_PRODUCTION = "true"

    const request = new Request(
      "https://app.example.com/menu?restaurant=alpha-bistro",
      {
        headers: {
          "x-restaurant-slug": "bravo-bistro",
        },
      }
    )
    expect(resolveRestaurantSlugFromRequest(request)).toBe(
      "alpha-bistro"
    )
  })

  it("builds canonical tenant-scoped links", () => {
    const entry = restaurantEntryPathForSlug("alpha-bistro", "/menu")
    expect(entry).toBe("/r/alpha-bistro?next=%2Fmenu")

    const links = buildRestaurantScopedLinks("alpha-bistro")
    expect(links.staffLogin).toBe(
      "/r/alpha-bistro?next=%2Fstaff-login"
    )
    expect(links.manager).toBe("/r/alpha-bistro?next=%2Fmanager")
  })
})
