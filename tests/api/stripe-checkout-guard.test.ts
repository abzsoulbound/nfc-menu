// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const getOrderForCheckoutSessionMock = vi.fn()
const updateOrderStripePaymentStateMock = vi.fn()
const createCheckoutSessionMock = vi.fn()
const persistOrderStripeIdsMock = vi.fn()

vi.mock("@/lib/restaurantRequest", () => ({
  withRestaurantRequestContext: async (
    _req: Request,
    run: (context: {
      restaurant: {
        slug: string
        payment: { stripeAccountId: string | null }
      }
      restaurantSlug: string
    }) => Promise<Response> | Response
  ) =>
    run({
      restaurant: {
        slug: "demo",
        payment: {
          stripeAccountId: "acct_demo_123",
        },
      },
      restaurantSlug: "demo",
    }),
}))

vi.mock("@/lib/runtimeStore", () => ({
  getOrderForCheckoutSession: (...args: unknown[]) =>
    getOrderForCheckoutSessionMock(...args),
  updateOrderStripePaymentState: (...args: unknown[]) =>
    updateOrderStripePaymentStateMock(...args),
}))

vi.mock("@/lib/stripeConnectBilling", () => ({
  createDirectCheckoutSessionForConnectedAccount: (...args: unknown[]) =>
    createCheckoutSessionMock(...args),
}))

vi.mock("@/lib/stripeBillingStore", () => ({
  persistOrderStripeIds: (...args: unknown[]) =>
    persistOrderStripeIdsMock(...args),
}))

import { POST } from "@/app/api/stripe/checkout/session/route"

describe("stripe checkout session guard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(process.env as Record<string, string | undefined>).NODE_ENV = "test"
    process.env.WAITER_PASSCODES = "1111"

    getOrderForCheckoutSessionMock.mockReturnValue({
      orderId: "order-1",
      sessionId: "session-1",
      tableNumber: 7,
      currency: "gbp",
      lineItems: [
        {
          name: "Espresso",
          quantity: 1,
          unitAmountMinor: 295,
        },
      ],
      totalAmountMinor: 295,
      checkoutSessionId: null,
      paymentIntentId: null,
      checkoutStatus: null,
    })

    createCheckoutSessionMock.mockResolvedValue({
      checkoutSessionId: "cs_test_123",
      paymentIntentId: "pi_test_123",
      checkoutUrl: "https://checkout.stripe.com/test",
      applicationFeeAmount: 12,
    })
    updateOrderStripePaymentStateMock.mockReturnValue(undefined)
    persistOrderStripeIdsMock.mockResolvedValue(undefined)
  })

  it("rejects checkout when caller does not own the order session", async () => {
    const req = new Request("http://localhost/api/stripe/checkout/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-id": "session-2",
      },
      body: JSON.stringify({
        orderId: "order-1",
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(createCheckoutSessionMock).not.toHaveBeenCalled()
  })

  it("sanitizes redirect urls to same-origin paths", async () => {
    const req = new Request("http://localhost/api/stripe/checkout/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-id": "session-1",
      },
      body: JSON.stringify({
        orderId: "order-1",
        successUrl: "https://evil.example.com/redirect",
        cancelUrl: "javascript:alert(1)",
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(createCheckoutSessionMock).toHaveBeenCalledTimes(1)
    const call = createCheckoutSessionMock.mock.calls[0]?.[0] as {
      successUrl: string
      cancelUrl: string
    }
    expect(call.successUrl).toContain("http://localhost/pay/7")
    expect(call.cancelUrl).toContain("http://localhost/pay/7")
    expect(call.successUrl).not.toContain("evil.example.com")
    expect(call.cancelUrl).not.toContain("javascript:")
  })
})
