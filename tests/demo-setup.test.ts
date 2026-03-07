import { describe, expect, it } from "vitest"
import {
  cloneDemoSetupConfig,
  DEFAULT_DEMO_SETUP_CONFIG,
  sanitizeDemoSetupConfig,
} from "@/lib/demoSetup"

describe("demo setup config", () => {
  it("falls back to defaults for invalid input", () => {
    expect(sanitizeDemoSetupConfig(null)).toEqual(
      DEFAULT_DEMO_SETUP_CONFIG
    )
  })

  it("sanitizes nested route copy and trims long strings", () => {
    const config = sanitizeDemoSetupConfig({
      companyName: "  Brewery Group  ",
      customerRoutes: {
        menu: {
          label: "This label is intentionally much too long to keep",
          desc: "  Signature browse flow for this buyer  ",
        },
      },
      staffRoutes: {
        manager: {
          label: "",
          desc: 42,
        },
      },
    })

    expect(config.companyName).toBe("Brewery Group")
    expect(config.customerRoutes.menu.label).toBe(
      "This label is intentiona"
    )
    expect(config.customerRoutes.menu.desc).toBe(
      "Signature browse flow for this buyer"
    )
    expect(config.staffRoutes.manager).toEqual(
      DEFAULT_DEMO_SETUP_CONFIG.staffRoutes.manager
    )
  })

  it("clones route maps without mutating the source config", () => {
    const cloned = cloneDemoSetupConfig(DEFAULT_DEMO_SETUP_CONFIG)
    cloned.customerRoutes.menu = {
      label: "Changed",
      desc: "Changed",
    }

    expect(DEFAULT_DEMO_SETUP_CONFIG.customerRoutes.menu.label).toBe(
      "Menu"
    )
    expect(DEFAULT_DEMO_SETUP_CONFIG.customerRoutes.menu.desc).toBe(
      "Browse menu"
    )
  })
})
