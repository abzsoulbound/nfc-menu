import { describe, expect, it } from "vitest"
import {
  clampWalkthroughStepIndex,
  detectWalkthroughStepIndexFromPathname,
} from "@/lib/demoWalkthrough"

describe("demo walkthrough helpers", () => {
  it("matches the most specific step prefix", () => {
    const index = detectWalkthroughStepIndexFromPathname({
      profileId: "FIRST_RUN",
      pathname: "/order/review/demo-tag",
    })
    expect(index).toBe(2)
  })

  it("clamps indices within profile bounds", () => {
    expect(clampWalkthroughStepIndex("RUSH_HOUR", -3)).toBe(0)
    expect(clampWalkthroughStepIndex("RUSH_HOUR", 400)).toBe(4)
  })
})
