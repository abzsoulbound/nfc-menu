import { expect, test } from "@playwright/test"

test.describe("customer flow", () => {
  test("can add quantity and open takeaway review", async ({
    page,
  }) => {
    await page.goto("/order/takeaway")

    await expect(page.getByText("Takeaway")).toBeVisible()
    const plusButton = page
      .locator("button")
      .filter({ hasText: "+" })
      .first()
    await expect(plusButton).toBeVisible()

    await plusButton.click()
    await plusButton.click()

    const basketButton = page.getByRole("button", {
      name: /Review/i,
    })
    await expect(basketButton.locator("span").first()).toHaveText(
      "2"
    )
    await basketButton.click()

    await expect(page.getByText("Review Order")).toBeVisible()
    await page
      .getByRole("button", { name: /^Review$/i })
      .click()

    await expect(page).toHaveURL(/\/order\/review\/takeaway$/)
  })
})
