import { expect, test } from "@playwright/test"

test.describe("customer flow", () => {
  test("can add quantity and open takeaway review", async ({
    page,
  }) => {
    await page.goto("/order/takeaway")

    await expect(page.getByText("Takeaway")).toBeVisible()
    await page
      .getByRole("button", { name: /^Add item$/i })
      .first()
      .click()

    const plusButton = page
      .locator("button")
      .filter({ hasText: "+" })
      .last()
    await expect(plusButton).toBeVisible()

    await plusButton.click()
    await page
      .getByRole("button", { name: /^Add to basket$/i })
      .click()

    const basketButton = page.getByRole("button", {
      name: /Open basket/i,
    })
    await expect(basketButton).toContainText("2")
    await basketButton.click()

    await expect(
      page.getByRole("heading", { name: "Review Order" })
    ).toBeVisible()
    await page
      .getByRole("button", { name: /^Review Order$/i })
      .click()

    await expect(page).toHaveURL(/\/order\/review\/takeaway$/)
  })
})
