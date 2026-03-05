const REQUIRED_IN_PRODUCTION = ["DATABASE_URL", "SYSTEM_AUTH_SECRET"]
const STAFF_AUTH_KEYS = [
  "STAFF_SESSION_SECRET",
  "STAFF_AUTH_SECRET",
  "WAITER_PASSCODES",
  "BAR_PASSCODES",
  "KITCHEN_PASSCODES",
  "MANAGER_PASSCODES",
  "ADMIN_PASSCODES",
]

let validated = false

export type PaymentMode = "SIMULATED" | "EXTERNAL"

function looksPlaceholderValue(value: string | undefined) {
  const normalized = value?.trim() ?? ""
  if (!normalized) return true
  if (
    normalized.startsWith("<") &&
    normalized.endsWith(">")
  ) {
    return true
  }

  const lowered = normalized.toLowerCase()
  if (lowered === "changeme") return true
  if (lowered.startsWith("replace_")) return true
  if (lowered.startsWith("replace-")) return true
  if (lowered.includes("replace_with")) return true
  if (lowered.includes("placeholder")) return true
  return false
}

function looksWeakSecret(value: string | undefined) {
  const normalized = value?.trim().toLowerCase() ?? ""
  if (!normalized) return true
  if (normalized === "changeme") return true
  if (normalized.includes("dev-")) return true
  if (normalized.includes("local-only")) return true
  if (normalized.length < 24) return true
  return false
}

function isStripeProvider(value: string | undefined) {
  const normalized = value?.trim().toUpperCase() ?? ""
  return (
    normalized === "STRIPE" ||
    normalized === "STRIPE_CONNECT" ||
    normalized === "STRIPE_CONNECT_STANDARD" ||
    normalized === "STRIPE_CONNECT_DESTINATION"
  )
}

function isLiveStripeSecretKey(value: string | undefined) {
  const normalized = value?.trim() ?? ""
  return (
    normalized.startsWith("sk_live_") ||
    normalized.startsWith("rk_live_")
  )
}

function isLiveStripePublishableKey(value: string | undefined) {
  return (value?.trim() ?? "").startsWith("pk_live_")
}

function looksLikeStripeClientId(value: string | undefined) {
  return (value?.trim() ?? "").startsWith("ca_")
}

function isHttpsUrl(value: string | undefined) {
  const normalized = value?.trim() ?? ""
  if (!normalized) return false
  try {
    return new URL(normalized).protocol === "https:"
  } catch {
    return false
  }
}

function looksLikeStripeWebhookSecret(value: string | undefined) {
  return (value?.trim() ?? "").startsWith("whsec_")
}

function looksLikeStripePriceId(value: string | undefined) {
  return (value?.trim() ?? "").startsWith("price_")
}

function resolveStripeSecretForValidation() {
  return (
    process.env.STRIPE_SECRET_KEY ??
    process.env.PAYMENT_PROVIDER_SECRET
  )
}

function resolveStripePublishableKeyForValidation() {
  return (
    process.env.STRIPE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  )
}

export function isEnabledFlag(value: string | undefined) {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  )
}

export function getPaymentMode(): PaymentMode {
  const raw = process.env.PAYMENT_MODE?.trim().toUpperCase()
  if (raw === "EXTERNAL") return "EXTERNAL"
  return "SIMULATED"
}

export function isSetupV2Enabled() {
  const raw = process.env.ENABLE_SETUP_V2
  if (raw === undefined || raw.trim() === "") return true
  return isEnabledFlag(raw)
}

export function isDurableRuntimeRequired() {
  return isEnabledFlag(process.env.ENABLE_DURABLE_RUNTIME_REQUIRED)
}

export function isNamedStaffAccountsEnabled() {
  const raw = process.env.ENABLE_NAMED_STAFF_ACCOUNTS
  if (raw === undefined || raw.trim() === "") return true
  return isEnabledFlag(raw)
}

export function isExternalPaymentsRequired() {
  return isEnabledFlag(process.env.ENABLE_EXTERNAL_PAYMENTS_REQUIRED)
}

export function getRuntimeFeatureFlags() {
  return {
    setupV2: isSetupV2Enabled(),
    durableRuntimeRequired: isDurableRuntimeRequired(),
    namedStaffAccounts: isNamedStaffAccountsEnabled(),
    externalPaymentsRequired: isExternalPaymentsRequired(),
    demoToolsEnabled: isDemoToolsEnabled(),
  }
}

export function validateRequiredEnv() {
  if (validated) return

  if (process.env.NODE_ENV !== "production") return

  const missing = REQUIRED_IN_PRODUCTION.filter(
    key => !process.env[key] || process.env[key] === "changeme"
  )
  const paymentProvider = process.env.PAYMENT_PROVIDER
  const isStripe = isStripeProvider(paymentProvider)

  const hasStaffAuth = STAFF_AUTH_KEYS.some(key => {
    const value = process.env[key]
    return !!value && value !== "changeme"
  })
  const paymentMode = getPaymentMode()

  if (!hasStaffAuth) {
    missing.push("STAFF_AUTH_SECRET or role passcode envs")
  }
  if (!process.env.STAFF_SESSION_SECRET) {
    missing.push("STAFF_SESSION_SECRET")
  }
  if (looksWeakSecret(process.env.SYSTEM_AUTH_SECRET)) {
    missing.push(
      "SYSTEM_AUTH_SECRET must be a long random production secret"
    )
  }
  if (looksWeakSecret(process.env.STAFF_SESSION_SECRET)) {
    missing.push(
      "STAFF_SESSION_SECRET must be a long random production secret"
    )
  }

  if (
    process.env.PAYMENT_MODE &&
    paymentMode === "SIMULATED" &&
    !isEnabledFlag(process.env.ALLOW_SIMULATED_PAYMENTS)
  ) {
    missing.push(
      "ALLOW_SIMULATED_PAYMENTS=true (required when PAYMENT_MODE=SIMULATED)"
    )
  } else if (paymentMode === "EXTERNAL") {
    const stripeSecret = resolveStripeSecretForValidation()
    const stripePublishableKey =
      resolveStripePublishableKeyForValidation()

    if (!process.env.PAYMENT_PROVIDER) {
      missing.push("PAYMENT_PROVIDER")
    }
    if (!stripeSecret) {
      missing.push("STRIPE_SECRET_KEY or PAYMENT_PROVIDER_SECRET")
    } else if (looksPlaceholderValue(stripeSecret)) {
      missing.push(
        "STRIPE_SECRET_KEY (or PAYMENT_PROVIDER_SECRET) must be a real live provider secret"
      )
    }
    if (isStripe) {
      if (!isLiveStripeSecretKey(stripeSecret)) {
        missing.push(
          "STRIPE_SECRET_KEY (or PAYMENT_PROVIDER_SECRET) must be a live Stripe secret key"
        )
      }
      if (!stripePublishableKey) {
        missing.push(
          "STRIPE_PUBLISHABLE_KEY or NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
        )
      } else if (
        looksPlaceholderValue(stripePublishableKey)
      ) {
        missing.push(
          "STRIPE_PUBLISHABLE_KEY (or NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) must be a real live Stripe publishable key"
        )
      } else if (
        !isLiveStripePublishableKey(stripePublishableKey)
      ) {
        missing.push(
          "STRIPE_PUBLISHABLE_KEY (or NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) must be a live Stripe publishable key"
        )
      }
      if (!process.env.STRIPE_CONNECT_CLIENT_ID) {
        missing.push("STRIPE_CONNECT_CLIENT_ID")
      } else if (
        looksPlaceholderValue(process.env.STRIPE_CONNECT_CLIENT_ID) ||
        !looksLikeStripeClientId(process.env.STRIPE_CONNECT_CLIENT_ID)
      ) {
        missing.push(
          "STRIPE_CONNECT_CLIENT_ID must be a real Stripe Connect client id"
        )
      }
      if (!process.env.STRIPE_CONNECT_OAUTH_REDIRECT_URI) {
        missing.push("STRIPE_CONNECT_OAUTH_REDIRECT_URI")
      } else if (
        looksPlaceholderValue(process.env.STRIPE_CONNECT_OAUTH_REDIRECT_URI) ||
        !isHttpsUrl(process.env.STRIPE_CONNECT_OAUTH_REDIRECT_URI)
      ) {
        missing.push(
          "STRIPE_CONNECT_OAUTH_REDIRECT_URI must be an https URL"
        )
      }
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        missing.push("STRIPE_WEBHOOK_SECRET")
      } else if (
        looksPlaceholderValue(process.env.STRIPE_WEBHOOK_SECRET) ||
        !looksLikeStripeWebhookSecret(process.env.STRIPE_WEBHOOK_SECRET)
      ) {
        missing.push(
          "STRIPE_WEBHOOK_SECRET must be a real Stripe webhook secret"
        )
      }
      if (!process.env.STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID) {
        missing.push("STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID")
      } else if (
        looksPlaceholderValue(
          process.env.STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID
        ) ||
        !looksLikeStripePriceId(
          process.env.STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID
        )
      ) {
        missing.push(
          "STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID must be a real Stripe price id"
        )
      }
    }
  }

  if (isDurableRuntimeRequired() && !process.env.DATABASE_URL) {
    missing.push(
      "DATABASE_URL (required when ENABLE_DURABLE_RUNTIME_REQUIRED=true)"
    )
  }

  if (isExternalPaymentsRequired() && paymentMode !== "EXTERNAL") {
    missing.push(
      "PAYMENT_MODE=EXTERNAL (required when ENABLE_EXTERNAL_PAYMENTS_REQUIRED=true)"
    )
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    )
  }

  validated = true
}

export function isDemoToolsEnabled() {
  if (process.env.NODE_ENV !== "production") return true
  return isEnabledFlag(process.env.ENABLE_DEMO_TOOLS)
}

export function resetEnvValidationCacheForTests() {
  validated = false
}
