import { describe, expect, it } from "vitest"
import {
  DEFAULT_CUSTOMER_EXPERIENCE_CONFIG,
  customerExperienceDefaultsForRestaurant,
  sanitizeCustomerExperienceConfig,
} from "@/lib/customerExperience"
import { getSalesDemoSlug } from "@/lib/tenant"

describe("customer experience config", () => {
  it("returns sales demo defaults for the dedicated sales-demo tenant", () => {
    const config = customerExperienceDefaultsForRestaurant({
      slug: getSalesDemoSlug(),
      isDemo: true,
    })
    expect(config.menu.heroTitle).toContain("Sales Demo")
    expect(config.launch.isPublished).toBe(true)
  })

  it("returns generic defaults for non-sales tenants", () => {
    const config = customerExperienceDefaultsForRestaurant({
      slug: "demo-template",
      isDemo: true,
    })
    expect(config.menu.heroTitle).toBe("Menu")
    expect(config.menu.heroSubtitle).toContain("starter menu")
    expect(config.launch.isPublished).toBe(false)
  })

  it("sanitizes invalid hrefs back to defaults", () => {
    const defaults = customerExperienceDefaultsForRestaurant({
      slug: "demo-template",
      isDemo: true,
    })

    const config = sanitizeCustomerExperienceConfig(
      {
        menu: {
          primaryCtaHref: "javascript:alert(1)",
          secondaryCtaHref: "https://example.com",
        },
      },
      { defaults }
    )

    expect(config.menu.primaryCtaHref).toBe(
      defaults.menu.primaryCtaHref
    )
    expect(config.menu.secondaryCtaHref).toBe(
      defaults.menu.secondaryCtaHref
    )
  })

  it("sanitizes theme and launch fields", () => {
    const config = sanitizeCustomerExperienceConfig({
      theme: {
        customerPrimary: "not-a-color",
        fontPreset: "INVALID",
      },
      launch: {
        isPublished: "yes",
      },
      ux: {
        menuDiscovery: "INVALID",
        trustMicrocopy: "ULTRA",
        defaultTipPercent: 999,
      },
    })

    expect(config.theme.customerPrimary).toBe(
      DEFAULT_CUSTOMER_EXPERIENCE_CONFIG.theme.customerPrimary
    )
    expect(config.theme.fontPreset).toBe(
      DEFAULT_CUSTOMER_EXPERIENCE_CONFIG.theme.fontPreset
    )
    expect(config.launch.isPublished).toBe(false)
    expect(config.ux.menuDiscovery).toBe(
      DEFAULT_CUSTOMER_EXPERIENCE_CONFIG.ux.menuDiscovery
    )
    expect(config.ux.trustMicrocopy).toBe(
      DEFAULT_CUSTOMER_EXPERIENCE_CONFIG.ux.trustMicrocopy
    )
    expect(config.ux.defaultTipPercent).toBe(30)
  })
})
