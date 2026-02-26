import { beforeEach, describe, expect, it } from "vitest"
import { isStaffTokenValid, requireStaff } from "@/lib/auth"

describe("auth", () => {
  beforeEach(() => {
    process.env.STAFF_AUTH_SECRET = "top-secret"
    delete process.env.WAITER_PASSCODES
    delete process.env.BAR_PASSCODES
    delete process.env.KITCHEN_PASSCODES
    delete process.env.MANAGER_PASSCODES
    delete process.env.ADMIN_PASSCODES
    ;(process.env as Record<string, string | undefined>).NODE_ENV =
      "test"
  })

  it("validates staff token", () => {
    expect(isStaffTokenValid("top-secret")).toBe(true)
    expect(isStaffTokenValid("wrong")).toBe(false)
  })

  it("rejects missing token when secret is configured", () => {
    const request = new Request("http://localhost")
    expect(() => requireStaff(request)).toThrow()
  })

  it("accepts valid token and returns staff identity", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-staff-auth": "top-secret",
        "x-staff-id": "staff-1",
      },
    })

    const staff = requireStaff(request)
    expect(staff.id).toBe("staff-1")
  })

  it("fails closed in production when no staff auth is configured", () => {
    const mutableEnv = process.env as Record<string, string | undefined>
    const previousNodeEnv = mutableEnv.NODE_ENV
    const previousStaffSecret = mutableEnv.STAFF_AUTH_SECRET
    const previousWaiterCodes = mutableEnv.WAITER_PASSCODES
    const previousBarCodes = mutableEnv.BAR_PASSCODES
    const previousKitchenCodes = mutableEnv.KITCHEN_PASSCODES
    const previousManagerCodes = mutableEnv.MANAGER_PASSCODES
    const previousAdminCodes = mutableEnv.ADMIN_PASSCODES

    mutableEnv.NODE_ENV = "production"
    mutableEnv.STAFF_AUTH_SECRET = "changeme"
    mutableEnv.WAITER_PASSCODES = ""
    mutableEnv.BAR_PASSCODES = ""
    mutableEnv.KITCHEN_PASSCODES = ""
    mutableEnv.MANAGER_PASSCODES = ""
    mutableEnv.ADMIN_PASSCODES = ""

    try {
      expect(isStaffTokenValid("top-secret")).toBe(false)
      expect(() =>
        requireStaff(new Request("http://localhost"))
      ).toThrow("Unauthorized: staff auth is not configured")
    } finally {
      mutableEnv.NODE_ENV = previousNodeEnv
      mutableEnv.STAFF_AUTH_SECRET = previousStaffSecret
      mutableEnv.WAITER_PASSCODES = previousWaiterCodes
      mutableEnv.BAR_PASSCODES = previousBarCodes
      mutableEnv.KITCHEN_PASSCODES = previousKitchenCodes
      mutableEnv.MANAGER_PASSCODES = previousManagerCodes
      mutableEnv.ADMIN_PASSCODES = previousAdminCodes
    }
  })
})
