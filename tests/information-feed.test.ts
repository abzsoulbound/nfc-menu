import { describe, expect, it } from "vitest"
import { resolveInformationFeed } from "@/lib/informationFeed"
import type { CustomerUxConfig } from "@/lib/types"

const ux: CustomerUxConfig = {
  presetId: "FULL_SERVICE_ASSURANCE",
  menuDiscovery: "HERO_FIRST",
  ordering: "GUIDED_CONFIGURATOR",
  review: "PAGE_REVIEW",
  checkout: "GUIDED_SPLIT",
  engagement: "TASK_TABS",
  orderSafetyMode: "STRICT",
  checkoutSafetyMode: "STRICT",
  socialProofMode: "VERIFIED_USAGE",
  tipPresetStrategy: "BALANCED",
  showProgressAnchors: true,
  emphasizeSocialProof: false,
  trustMicrocopy: "HIGH_ASSURANCE",
  defaultTipPercent: 12.5,
}

describe("information feed resolver", () => {
  it("returns customer feed for menu route with ux digest", () => {
    const feed = resolveInformationFeed({
      pathname: "/menu",
      restaurantName: "Fable Stores",
      ux,
    })

    expect(feed.context).toBe("Customer")
    expect(feed.title).toContain("Fable Stores")
    expect(feed.checks.some(check => check.includes("Hero-first"))).toBe(
      true
    )
    expect(feed.actions[0]?.nextPath).toBe("/order/takeaway")
  })

  it("returns manager features feed", () => {
    const feed = resolveInformationFeed({
      pathname: "/manager/features",
      restaurantName: "Fable Stores",
      ux,
    })

    expect(feed.context).toBe("Manager")
    expect(feed.title).toContain("Growth")
    expect(feed.actions.some(action => action.nextPath === "/menu")).toBe(
      true
    )
  })

  it("returns fallback feed for unknown route", () => {
    const feed = resolveInformationFeed({
      pathname: "/unknown-area",
      restaurantName: "Fable Stores",
      ux,
    })

    expect(feed.context).toBe("Info")
    expect(feed.actions.length).toBeGreaterThan(0)
  })
})
