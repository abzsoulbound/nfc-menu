// @vitest-environment node
import { createHmac } from "crypto"
import { afterEach, describe, expect, it } from "vitest"
import {
  createStripeConnectAuthorizeUrl,
  verifyAndParseStripeWebhook,
  verifyStripeConnectState,
} from "@/lib/payments"

const mutableEnv = process.env as Record<string, string | undefined>

const previousSystemAuthSecret = mutableEnv.SYSTEM_AUTH_SECRET
const previousStripeWebhookSecret = mutableEnv.STRIPE_WEBHOOK_SECRET
const previousPaymentProvider = mutableEnv.PAYMENT_PROVIDER
const previousStripeConnectClientId = mutableEnv.STRIPE_CONNECT_CLIENT_ID
const previousStripeConnectRedirectUri =
  mutableEnv.STRIPE_CONNECT_OAUTH_REDIRECT_URI

function signWebhook(payload: string, timestamp: number) {
  const content = `${timestamp}.${payload}`
  return createHmac(
    "sha256",
    mutableEnv.STRIPE_WEBHOOK_SECRET ?? ""
  )
    .update(content)
    .digest("hex")
}

afterEach(() => {
  mutableEnv.SYSTEM_AUTH_SECRET = previousSystemAuthSecret
  mutableEnv.STRIPE_WEBHOOK_SECRET = previousStripeWebhookSecret
  mutableEnv.PAYMENT_PROVIDER = previousPaymentProvider
  mutableEnv.STRIPE_CONNECT_CLIENT_ID = previousStripeConnectClientId
  mutableEnv.STRIPE_CONNECT_OAUTH_REDIRECT_URI =
    previousStripeConnectRedirectUri
})

describe("payments", () => {
  it("accepts any valid Stripe v1 signature in the header", () => {
    mutableEnv.STRIPE_WEBHOOK_SECRET = "whsec_test_secret"
    const payload = JSON.stringify({
      id: "evt_123",
      type: "payment_intent.succeeded",
      data: {
        object: {},
      },
    })
    const timestamp = Math.floor(Date.now() / 1000)
    const valid = signWebhook(payload, timestamp)
    const header = `t=${timestamp},v1=invalidsig,v1=${valid}`

    const event = verifyAndParseStripeWebhook({
      payload,
      signatureHeader: header,
    })

    expect(event.id).toBe("evt_123")
  })

  it("normalizes Stripe Connect state slugs", () => {
    mutableEnv.SYSTEM_AUTH_SECRET = "system-secret"
    mutableEnv.PAYMENT_PROVIDER = "STRIPE_CONNECT_STANDARD"
    mutableEnv.STRIPE_CONNECT_CLIENT_ID = "ca_test_123"
    mutableEnv.STRIPE_CONNECT_OAUTH_REDIRECT_URI =
      "https://example.com/callback"
    const { state } = createStripeConnectAuthorizeUrl({
      restaurantSlug: "FABLE-STORES",
    })

    const parsed = verifyStripeConnectState(state)

    expect(parsed.restaurantSlug).toBe("fable-stores")
  })

  it("rejects invalid Stripe Connect state slugs", () => {
    mutableEnv.SYSTEM_AUTH_SECRET = "system-secret"
    mutableEnv.PAYMENT_PROVIDER = "STRIPE_CONNECT_STANDARD"

    expect(() =>
      createStripeConnectAuthorizeUrl({
        restaurantSlug: "../bad",
      })
    ).toThrow(/invalid restaurant slug/i)
  })
})
