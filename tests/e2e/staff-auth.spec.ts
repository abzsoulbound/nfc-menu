import { expect, test, type Page } from "@playwright/test"
import {
  isStaffAuthConfigured,
  resolveRolePasscode,
} from "./helpers"

async function enterPasscode(page: Page, passcode: string) {
  for (const digit of passcode) {
    await page.getByRole("button", { name: digit }).click()
  }
  await page.getByRole("button", { name: "Go" }).click()
}

test.describe("staff login", () => {
  test("waiter passcode opens staff dashboard", async ({
    page,
  }) => {
    const authConfigured = isStaffAuthConfigured()
    const waiterCode = resolveRolePasscode("WAITER")

    test.skip(
      authConfigured && !waiterCode,
      "Staff auth is enabled but no WAITER passcode was found."
    )

    await page.goto("/staff-login?next=/staff")
    await expect(
      page.getByRole("heading", { name: "Staff Access" })
    ).toBeVisible()

    if (!authConfigured) {
      await expect(page.getByRole("button", { name: "Go" })).toBeVisible()
      return
    }

    await enterPasscode(page, waiterCode!)
    await expect(page).toHaveURL(/\/staff$/)
    await expect(page.getByText("Ready to deliver")).toBeVisible()
  })

  test("admin passcode opens admin controls when configured", async ({
    page,
  }) => {
    const adminCode = resolveRolePasscode("ADMIN")
    test.skip(!adminCode, "No ADMIN passcode configured for e2e.")

    await page.goto("/staff-login?next=/admin")
    await enterPasscode(page, adminCode!)

    await expect(page).toHaveURL(/\/admin$/)
    await expect(
      page.getByRole("heading", { name: "Admin Control" })
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Menu Controls" })
    ).toBeVisible()
  })

  test("kitchen and bar passcodes fall back to role home when next route is incompatible", async ({
    page,
  }) => {
    const kitchenCode = resolveRolePasscode("KITCHEN")
    const barCode = resolveRolePasscode("BAR")
    test.skip(
      !kitchenCode || !barCode,
      "KITCHEN and BAR passcodes are required for this scenario."
    )

    await page.goto("/staff-login?next=/staff")
    await enterPasscode(page, kitchenCode!)
    await expect(page).toHaveURL(/\/kitchen$/)

    await page.goto("/staff-login?next=/staff")
    await enterPasscode(page, barCode!)
    await expect(page).toHaveURL(/\/bar$/)
  })
})
