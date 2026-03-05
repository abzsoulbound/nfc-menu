// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
  issueStaffSessionToken,
  verifyStaffSessionToken,
} from "@/lib/staffSessionServer"

describe("staff session token", () => {
  it("issues and verifies a signed staff session token", () => {
    const token = issueStaffSessionToken("MANAGER", "demo")
    expect(token).toBeTruthy()

    const verified = verifyStaffSessionToken(token)
    expect(verified?.role).toBe("MANAGER")
    expect(verified?.tenantSlug).toBe("demo")
  })
})
