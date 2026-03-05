import { describe, expect, it } from "vitest"
import { DEFAULT_CUSTOMER_EXPERIENCE_CONFIG } from "@/lib/customerExperience"
import {
  assertRestaurantSubscriptionActive,
  type RestaurantProfile,
} from "@/lib/restaurants"

function makeRestaurant(
  overrides?: Partial<RestaurantProfile>
): RestaurantProfile {
  return {
    slug: "acme-bistro",
    name: "Acme Bistro",
    monogram: "AB",
    location: null,
    assets: {},
    experienceConfig: {
      ...DEFAULT_CUSTOMER_EXPERIENCE_CONFIG,
      menu: {
        heroTitle: "Welcome",
        heroSubtitle: "Order at table",
        showMetaStats: true,
        showPlaceholderNote: false,
        primaryCtaLabel: "Start",
        primaryCtaHref: "/menu",
        secondaryCtaLabel: "Review",
        secondaryCtaHref: "/review",
      },
      review: {
        title: "Review",
        subtitleDineIn: "Check your order",
        subtitleTakeaway: "Check your takeaway",
        placeOrderLabel: "Place order",
        backLabel: "Back",
        confirmDineIn: "Send to kitchen",
        confirmTakeaway: "Send takeaway",
        showAllergens: true,
      },
    },
    payment: {
      provider: "STRIPE_CONNECT_STANDARD",
      stripeAccountId: "acct_test_123",
      stripeAccountStatus: "CONNECTED",
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      platformFeeBps: 250,
    },
    subscription: {
      stripeCustomerId: "cus_test_123",
      stripeSubscriptionId: "sub_test_123",
      status: "ACTIVE",
      active: true,
    },
    isDemo: false,
    planTier: "starter",
    billingStatus: "trial",
    ...overrides,
  }
}

describe("subscription access", () => {
  it("allows active tenants", () => {
    expect(() =>
      assertRestaurantSubscriptionActive(makeRestaurant())
    ).not.toThrow()
  })

  it("blocks inactive production tenants", () => {
    expect(() =>
      assertRestaurantSubscriptionActive(
        makeRestaurant({
          subscription: {
            stripeCustomerId: "cus_test_123",
            stripeSubscriptionId: "sub_test_123",
            status: "PAST_DUE",
            active: false,
          },
        })
      )
    ).toThrow(/subscription is past_due/i)
  })

  it("allows demo tenants regardless of subscription state", () => {
    expect(() =>
      assertRestaurantSubscriptionActive(
        makeRestaurant({
          isDemo: true,
          subscription: {
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            status: "INACTIVE",
            active: false,
          },
        })
      )
    ).not.toThrow()
  })
})
