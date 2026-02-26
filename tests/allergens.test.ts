import { describe, expect, it } from "vitest"
import {
  detectIntroducedAllergens,
  hasNewAllergens,
  resolveAllergens,
} from "@/lib/allergens"

describe("allergens", () => {
  it("resolves removals and add-ons", () => {
    const resolved = resolveAllergens(
      ["gluten", "dairy"],
      {
        removals: ["bread"],
        addOns: [{ name: "cheese" }],
      },
      {
        base: ["gluten", "dairy"],
        removals: { bread: ["gluten"] },
        addOns: { cheese: ["dairy"] },
      }
    )

    expect(resolved).toContain("dairy")
    expect(resolved).not.toContain("gluten")
  })

  it("detects newly introduced allergens", () => {
    const introduced = detectIntroducedAllergens(
      ["gluten"],
      ["gluten", "soy"]
    )

    expect(introduced).toEqual(["soy"])
    expect(hasNewAllergens(["gluten"], ["gluten", "soy"]))
      .toBe(true)
  })
})
