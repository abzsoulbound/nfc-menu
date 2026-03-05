import { describe, expect, it } from "vitest"
import {
  applyCustomerExperiencePreset,
  DEFAULT_CUSTOMER_EXPERIENCE_CONFIG,
  customerExperienceDefaultsForRestaurant,
  sanitizeCustomerExperienceConfig,
  tipPresetsForStrategy,
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

  it("applies full-service defaults for non-demo tenants", () => {
    const config = customerExperienceDefaultsForRestaurant({
      slug: "acme-bistro",
      isDemo: false,
    })
    expect(config.ux.presetId).toBe("FULL_SERVICE_ASSURANCE")
    expect(config.ux.orderSafetyMode).toBe("STRICT")
    expect(config.ux.checkout).toBe("GUIDED_SPLIT")
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
        presetId: "NOPE",
        menuDiscovery: "INVALID",
        orderSafetyMode: "UNKNOWN",
        checkoutSafetyMode: "UNKNOWN",
        socialProofMode: "UNKNOWN",
        tipPresetStrategy: "UNKNOWN",
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
    expect(config.ux.presetId).toBe(
      DEFAULT_CUSTOMER_EXPERIENCE_CONFIG.ux.presetId
    )
    expect(config.ux.orderSafetyMode).toBe(
      DEFAULT_CUSTOMER_EXPERIENCE_CONFIG.ux.orderSafetyMode
    )
    expect(config.ux.checkoutSafetyMode).toBe(
      DEFAULT_CUSTOMER_EXPERIENCE_CONFIG.ux.checkoutSafetyMode
    )
    expect(config.ux.socialProofMode).toBe(
      DEFAULT_CUSTOMER_EXPERIENCE_CONFIG.ux.socialProofMode
    )
    expect(config.ux.tipPresetStrategy).toBe(
      DEFAULT_CUSTOMER_EXPERIENCE_CONFIG.ux.tipPresetStrategy
    )
    expect(config.ux.trustMicrocopy).toBe(
      DEFAULT_CUSTOMER_EXPERIENCE_CONFIG.ux.trustMicrocopy
    )
    expect(config.ux.defaultTipPercent).toBe(30)
  })

  it("derives social proof mode from legacy emphasizeSocialProof toggle", () => {
    const config = sanitizeCustomerExperienceConfig({
      ux: {
        emphasizeSocialProof: true,
      },
    })
    expect(config.ux.socialProofMode).toBe("VERIFIED_USAGE")
    expect(config.ux.emphasizeSocialProof).toBe(true)
  })

  it("applies preset pack and tip strategy presets", () => {
    const applied = applyCustomerExperiencePreset(
      DEFAULT_CUSTOMER_EXPERIENCE_CONFIG,
      "BAR_LOUNGE_SAFE_EXPRESS"
    )
    expect(applied.ux.presetId).toBe("BAR_LOUNGE_SAFE_EXPRESS")
    expect(applied.ux.menuDiscovery).toBe("SEARCH_FIRST")
    expect(applied.ux.checkout).toBe("ONE_PAGE")

    const tips = tipPresetsForStrategy({
      strategy: "PREMIUM",
      defaultTipPercent: 12.5,
    })
    expect(tips).toContain(12.5)
    expect(tips).toContain(18)
  })
})
