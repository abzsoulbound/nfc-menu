// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest"
import {
  getRestaurantStaffAuth,
  resolveRestaurantRoleForPasscode,
} from "@/lib/restaurants"

const mutableEnv = process.env as Record<string, string | undefined>

const previousNodeEnv = mutableEnv.NODE_ENV
const previousDatabaseUrl = mutableEnv.DATABASE_URL
const previousStaffAuthSecret = mutableEnv.STAFF_AUTH_SECRET
const previousWaiterCodes = mutableEnv.WAITER_PASSCODES
const previousBarCodes = mutableEnv.BAR_PASSCODES
const previousKitchenCodes = mutableEnv.KITCHEN_PASSCODES
const previousManagerCodes = mutableEnv.MANAGER_PASSCODES
const previousAdminCodes = mutableEnv.ADMIN_PASSCODES
const previousSalesDemoSlug = mutableEnv.SALES_DEMO_SLUG

function clearPasscodes() {
  delete mutableEnv.STAFF_AUTH_SECRET
  delete mutableEnv.WAITER_PASSCODES
  delete mutableEnv.BAR_PASSCODES
  delete mutableEnv.KITCHEN_PASSCODES
  delete mutableEnv.MANAGER_PASSCODES
  delete mutableEnv.ADMIN_PASSCODES
}

afterEach(() => {
  mutableEnv.NODE_ENV = previousNodeEnv
  mutableEnv.DATABASE_URL = previousDatabaseUrl
  mutableEnv.STAFF_AUTH_SECRET = previousStaffAuthSecret
  mutableEnv.WAITER_PASSCODES = previousWaiterCodes
  mutableEnv.BAR_PASSCODES = previousBarCodes
  mutableEnv.KITCHEN_PASSCODES = previousKitchenCodes
  mutableEnv.MANAGER_PASSCODES = previousManagerCodes
  mutableEnv.ADMIN_PASSCODES = previousAdminCodes
  mutableEnv.SALES_DEMO_SLUG = previousSalesDemoSlug
})

describe("restaurant staff auth fallback", () => {
  it("fails closed in production when tenant auth storage is unavailable", async () => {
    mutableEnv.NODE_ENV = "production"
    delete mutableEnv.DATABASE_URL
    clearPasscodes()

    const auth = await getRestaurantStaffAuth("demo")

    expect(auth.WAITER).toEqual([])
    expect(auth.BAR).toEqual([])
    expect(auth.KITCHEN).toEqual([])
    expect(auth.MANAGER).toEqual([])
    expect(auth.ADMIN).toEqual([])
    await expect(
      resolveRestaurantRoleForPasscode("demo", "9999")
    ).resolves.toBeNull()
  })

  it("keeps local default passcodes outside production", async () => {
    mutableEnv.NODE_ENV = "development"
    delete mutableEnv.DATABASE_URL
    clearPasscodes()

    await expect(
      resolveRestaurantRoleForPasscode("demo", "9999")
    ).resolves.toBe("ADMIN")
  })

  it("uses explicit sales demo env passcodes even when db storage is enabled", async () => {
    mutableEnv.NODE_ENV = "production"
    mutableEnv.DATABASE_URL = "postgres://example.invalid/db"
    mutableEnv.SALES_DEMO_SLUG = "sales-demo"
    mutableEnv.WAITER_PASSCODES = "5827"
    mutableEnv.BAR_PASSCODES = "7394"
    mutableEnv.KITCHEN_PASSCODES = "8461"
    mutableEnv.MANAGER_PASSCODES = "9172"
    mutableEnv.ADMIN_PASSCODES = "2685"

    const auth = await getRestaurantStaffAuth("sales-demo")
    expect(auth.WAITER).toContain("5827")
    expect(auth.MANAGER).toContain("9172")

    await expect(
      resolveRestaurantRoleForPasscode("sales-demo", "9172")
    ).resolves.toBe("MANAGER")
  })
})
