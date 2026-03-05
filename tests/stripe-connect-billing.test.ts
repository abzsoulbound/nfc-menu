// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
  calculateApplicationFeeAmount,
  parseConnectedAccountStatusFromV2Account,
  readStripeMetadata,
} from "@/lib/stripeConnectBilling"

describe("stripe connect + billing helpers", () => {
  it("calculates a 2% application fee in minor units", () => {
    expect(calculateApplicationFeeAmount(100_000)).toBe(2_000)
    expect(calculateApplicationFeeAmount(501)).toBe(10)
  })

  it("extracts metadata from Stripe objects", () => {
    const metadata = readStripeMetadata({
      metadata: {
        restaurant_slug: "Fable-Stores",
        order_id: "8f216f2a-953a-4a3a-8bb9-24961f2ea5de",
      },
    })

    expect(metadata.restaurantSlug).toBe("fable-stores")
    expect(metadata.orderId).toBe(
      "8f216f2a-953a-4a3a-8bb9-24961f2ea5de"
    )
  })

  it("maps V2 account capability state into connection flags", () => {
    const status = parseConnectedAccountStatusFromV2Account({
      configuration: {
        recipient: {
          capabilities: {
            stripe_balance: {
              stripe_transfers: {
                status: "active",
              },
            },
          },
        },
      },
      requirements: {
        summary: {
          minimum_deadline: {
            status: "none",
          },
        },
      },
    })

    expect(status.chargesEnabled).toBe(true)
    expect(status.payoutsEnabled).toBe(true)
    expect(status.detailsSubmitted).toBe(true)
    expect(status.status).toBe("CONNECTED")
  })
})
