// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest"
import {
  getPaymentMode,
  getRuntimeFeatureFlags,
  isDemoToolsEnabled,
  isEnabledFlag,
  resetEnvValidationCacheForTests,
  validateRequiredEnv,
} from "@/lib/env"

const mutableEnv = process.env as Record<string, string | undefined>

const previousNodeEnv = mutableEnv.NODE_ENV
const previousEnableDemoTools = mutableEnv.ENABLE_DEMO_TOOLS
const previousPaymentMode = mutableEnv.PAYMENT_MODE
const previousEnableSetupV2 = mutableEnv.ENABLE_SETUP_V2
const previousDatabaseUrl = mutableEnv.DATABASE_URL
const previousSystemAuthSecret = mutableEnv.SYSTEM_AUTH_SECRET
const previousStaffAuthSecret = mutableEnv.STAFF_AUTH_SECRET
const previousStaffSessionSecret = mutableEnv.STAFF_SESSION_SECRET
const previousPaymentProvider = mutableEnv.PAYMENT_PROVIDER
const previousPaymentProviderSecret = mutableEnv.PAYMENT_PROVIDER_SECRET
const previousStripePublishableKey =
  mutableEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const previousStripeConnectClientId =
  mutableEnv.STRIPE_CONNECT_CLIENT_ID
const previousStripeConnectRedirectUri =
  mutableEnv.STRIPE_CONNECT_OAUTH_REDIRECT_URI
const previousStripeWebhookSecret =
  mutableEnv.STRIPE_WEBHOOK_SECRET
const previousStripePriceId =
  mutableEnv.STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID

afterEach(() => {
  mutableEnv.NODE_ENV = previousNodeEnv
  mutableEnv.ENABLE_DEMO_TOOLS = previousEnableDemoTools
  mutableEnv.PAYMENT_MODE = previousPaymentMode
  mutableEnv.ENABLE_SETUP_V2 = previousEnableSetupV2
  mutableEnv.DATABASE_URL = previousDatabaseUrl
  mutableEnv.SYSTEM_AUTH_SECRET = previousSystemAuthSecret
  mutableEnv.STAFF_AUTH_SECRET = previousStaffAuthSecret
  mutableEnv.STAFF_SESSION_SECRET = previousStaffSessionSecret
  mutableEnv.PAYMENT_PROVIDER = previousPaymentProvider
  mutableEnv.PAYMENT_PROVIDER_SECRET = previousPaymentProviderSecret
  mutableEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY =
    previousStripePublishableKey
  mutableEnv.STRIPE_CONNECT_CLIENT_ID =
    previousStripeConnectClientId
  mutableEnv.STRIPE_CONNECT_OAUTH_REDIRECT_URI =
    previousStripeConnectRedirectUri
  mutableEnv.STRIPE_WEBHOOK_SECRET =
    previousStripeWebhookSecret
  mutableEnv.STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID =
    previousStripePriceId
  resetEnvValidationCacheForTests()
})

describe("env", () => {
  it("enables demo tools outside production", () => {
    mutableEnv.NODE_ENV = "development"
    delete mutableEnv.ENABLE_DEMO_TOOLS

    expect(isDemoToolsEnabled()).toBe(true)
  })

  it("disables demo tools by default in production", () => {
    mutableEnv.NODE_ENV = "production"
    delete mutableEnv.ENABLE_DEMO_TOOLS

    expect(isDemoToolsEnabled()).toBe(false)
  })

  it("allows demo tools in production when explicitly enabled", () => {
    mutableEnv.NODE_ENV = "production"
    mutableEnv.ENABLE_DEMO_TOOLS = "true"

    expect(isDemoToolsEnabled()).toBe(true)
  })

  it("defaults payment mode to simulated", () => {
    delete mutableEnv.PAYMENT_MODE

    expect(getPaymentMode()).toBe("SIMULATED")
  })

  it("uses external payment mode when configured", () => {
    mutableEnv.PAYMENT_MODE = "EXTERNAL"

    expect(getPaymentMode()).toBe("EXTERNAL")
  })

  it("parses enabled flags consistently", () => {
    expect(isEnabledFlag("true")).toBe(true)
    expect(isEnabledFlag("1")).toBe(true)
    expect(isEnabledFlag("yes")).toBe(true)
    expect(isEnabledFlag("false")).toBe(false)
  })

  it("includes rollout feature flags in runtime payload", () => {
    mutableEnv.ENABLE_SETUP_V2 = "true"
    const flags = getRuntimeFeatureFlags()
    expect(flags.setupV2).toBe(true)
  })

  it("does not cache failed production env validation", () => {
    mutableEnv.NODE_ENV = "production"
    delete mutableEnv.DATABASE_URL
    mutableEnv.SYSTEM_AUTH_SECRET = "123456789012345678901234"
    mutableEnv.STAFF_AUTH_SECRET = "1234"
    mutableEnv.STAFF_SESSION_SECRET = "123456789012345678901234"
    delete mutableEnv.PAYMENT_MODE

    expect(() => validateRequiredEnv()).toThrow(
      /DATABASE_URL/
    )
    expect(() => validateRequiredEnv()).toThrow(
      /DATABASE_URL/
    )
  })

  it("requires a dedicated strong staff session secret in production", () => {
    mutableEnv.NODE_ENV = "production"
    mutableEnv.DATABASE_URL = "postgres://example"
    mutableEnv.SYSTEM_AUTH_SECRET = "123456789012345678901234"
    mutableEnv.STAFF_AUTH_SECRET = "1234"
    delete mutableEnv.STAFF_SESSION_SECRET

    expect(() => validateRequiredEnv()).toThrow(
      /STAFF_SESSION_SECRET/
    )
  })

  it("rejects weak system secrets in production", () => {
    mutableEnv.NODE_ENV = "production"
    mutableEnv.DATABASE_URL = "postgres://example"
    mutableEnv.SYSTEM_AUTH_SECRET = "weak"
    mutableEnv.STAFF_AUTH_SECRET = "1234"
    mutableEnv.STAFF_SESSION_SECRET = "123456789012345678901234"

    expect(() => validateRequiredEnv()).toThrow(
      /SYSTEM_AUTH_SECRET must be a long random production secret/
    )
  })

  it("rejects Stripe test keys in production external mode", () => {
    mutableEnv.NODE_ENV = "production"
    mutableEnv.DATABASE_URL = "postgresql://db.example.com/app?sslmode=require"
    mutableEnv.SYSTEM_AUTH_SECRET = "123456789012345678901234"
    mutableEnv.STAFF_AUTH_SECRET = "1234"
    mutableEnv.STAFF_SESSION_SECRET = "123456789012345678901234"
    mutableEnv.PAYMENT_MODE = "EXTERNAL"
    mutableEnv.PAYMENT_PROVIDER = "STRIPE_CONNECT"
    mutableEnv.PAYMENT_PROVIDER_SECRET =
      "sk_test_example_test_secret_key"
    mutableEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY =
      "pk_test_example_publishable_key"
    mutableEnv.STRIPE_CONNECT_CLIENT_ID = "ca_example"
    mutableEnv.STRIPE_CONNECT_OAUTH_REDIRECT_URI =
      "https://fable-stores-nfc-menu.vercel.app/api/stripe/connect/callback"
    mutableEnv.STRIPE_WEBHOOK_SECRET = "whsec_example"
    mutableEnv.STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID =
      "price_example"

    expect(() => validateRequiredEnv()).toThrow(
      /STRIPE_SECRET_KEY \(or PAYMENT_PROVIDER_SECRET\) must be a live Stripe secret key/
    )
  })
})
