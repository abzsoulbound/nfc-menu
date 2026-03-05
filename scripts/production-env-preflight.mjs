import fs from "node:fs"
import path from "node:path"

const DEFAULT_ENV_FILE = ".env.neoncheck.production"
const DEFAULT_DB_CHECK_TIMEOUT_MS = 10_000
const WEAK_PASSCODES = new Set([
  "0000",
  "1111",
  "1234",
  "2222",
  "3333",
  "4444",
  "5555",
  "6666",
  "7777",
  "8888",
  "9999",
])

function stripOuterQuotes(value) {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1)
  }
  return value
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Env file not found: ${filePath}`)
  }

  const raw = fs.readFileSync(filePath, "utf8")
  const lines = raw.split(/\r?\n/)
  const env = {}

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eqIndex = line.indexOf("=")
    if (eqIndex <= 0) continue
    const key = line.slice(0, eqIndex).trim()
    const value = stripOuterQuotes(line.slice(eqIndex + 1).trim())
    env[key] = value
  }

  return env
}

function getArgValue(flag) {
  const index = process.argv.indexOf(flag)
  if (index < 0) return ""
  return process.argv[index + 1]?.trim() ?? ""
}

function isEnabled(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  )
}

function hasValue(env, key) {
  const value = env[key]
  return typeof value === "string" && value.trim() !== ""
}

function looksWeakSecret(value) {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) return true
  if (normalized === "changeme") return true
  if (normalized.includes("dev-")) return true
  if (normalized.includes("local-only")) return true
  if (normalized.length < 24) return true
  return false
}

function looksPlaceholderValue(value) {
  const normalized = String(value ?? "").trim()
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

function isLocalDatabaseUrl(value) {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) return false
  return (
    normalized.includes("://localhost") ||
    normalized.includes("@localhost") ||
    normalized.includes("://127.0.0.1") ||
    normalized.includes("@127.0.0.1") ||
    normalized.includes("sslmode=disable")
  )
}

function isLiveStripeSecretKey(value) {
  const normalized = String(value ?? "").trim()
  return (
    normalized.startsWith("sk_live_") ||
    normalized.startsWith("rk_live_")
  )
}

function isLiveStripePublishableKey(value) {
  return String(value ?? "").trim().startsWith("pk_live_")
}

function looksLikeStripeClientId(value) {
  return String(value ?? "").trim().startsWith("ca_")
}

function isHttpsUrl(value) {
  const normalized = String(value ?? "").trim()
  if (!normalized) return false
  try {
    return new URL(normalized).protocol === "https:"
  } catch {
    return false
  }
}

function looksLikeStripeWebhookSecret(value) {
  return String(value ?? "").trim().startsWith("whsec_")
}

function looksLikeStripePriceId(value) {
  return String(value ?? "").trim().startsWith("price_")
}

function parseCodes(value) {
  if (!value || String(value).trim() === "") return []
  return String(value)
    .split(",")
    .map(entry => entry.trim())
    .filter(Boolean)
}

function pushError(errors, message) {
  errors.push(message)
}

function pushWarning(warnings, message) {
  warnings.push(message)
}

function resolveStripeSecret(env) {
  return env.STRIPE_SECRET_KEY || env.PAYMENT_PROVIDER_SECRET
}

function resolveStripePublishableKey(env) {
  return (
    env.STRIPE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  )
}

function validateEnv(env) {
  const errors = []
  const warnings = []

  if (!hasValue(env, "DATABASE_URL")) {
    pushError(errors, "DATABASE_URL is required.")
  } else if (isLocalDatabaseUrl(env.DATABASE_URL)) {
    pushError(
      errors,
      "DATABASE_URL must point to a hosted production database with SSL enabled."
    )
  }

  if (!hasValue(env, "SYSTEM_AUTH_SECRET")) {
    pushError(errors, "SYSTEM_AUTH_SECRET is required.")
  } else if (looksWeakSecret(env.SYSTEM_AUTH_SECRET)) {
    pushError(
      errors,
      "SYSTEM_AUTH_SECRET is weak. Use a long random production secret."
    )
  }

  if (!hasValue(env, "STAFF_SESSION_SECRET")) {
    pushError(errors, "STAFF_SESSION_SECRET is required.")
  } else if (looksWeakSecret(env.STAFF_SESSION_SECRET)) {
    pushError(
      errors,
      "STAFF_SESSION_SECRET is weak. Use a long random production secret."
    )
  }

  const paymentMode = String(env.PAYMENT_MODE ?? "")
    .trim()
    .toUpperCase()
  if (paymentMode !== "EXTERNAL") {
    pushError(
      errors,
      "PAYMENT_MODE must be EXTERNAL for launch-grade production."
    )
  }

  if (!hasValue(env, "PAYMENT_PROVIDER")) {
    pushError(errors, "PAYMENT_PROVIDER is required for external payments.")
  }
  const stripeSecret = resolveStripeSecret(env)
  const stripePublishableKey = resolveStripePublishableKey(env)

  if (!stripeSecret || String(stripeSecret).trim() === "") {
    pushError(
      errors,
      "STRIPE_SECRET_KEY (or PAYMENT_PROVIDER_SECRET) is required for external payments."
    )
  } else if (looksPlaceholderValue(stripeSecret)) {
    pushError(
      errors,
      "STRIPE_SECRET_KEY (or PAYMENT_PROVIDER_SECRET) still uses a placeholder value."
    )
  } else if (looksWeakSecret(stripeSecret)) {
    pushWarning(
      warnings,
      "STRIPE_SECRET_KEY (or PAYMENT_PROVIDER_SECRET) looks short or development-like. Recheck the live secret."
    )
  }

  const paymentProvider = String(env.PAYMENT_PROVIDER ?? "")
    .trim()
    .toUpperCase()
  if (
    paymentProvider === "STRIPE" ||
    paymentProvider === "STRIPE_CONNECT" ||
    paymentProvider === "STRIPE_CONNECT_STANDARD" ||
    paymentProvider === "STRIPE_CONNECT_DESTINATION"
  ) {
    if (!stripePublishableKey || String(stripePublishableKey).trim() === "") {
      pushError(
        errors,
        "STRIPE_PUBLISHABLE_KEY (or NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) is required for Stripe Connect."
      )
    } else if (
      looksPlaceholderValue(stripePublishableKey)
    ) {
      pushError(
        errors,
        "STRIPE_PUBLISHABLE_KEY (or NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) still uses a placeholder value."
      )
    } else if (
      !isLiveStripePublishableKey(stripePublishableKey)
    ) {
      pushError(
        errors,
        "STRIPE_PUBLISHABLE_KEY (or NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) must be a live Stripe publishable key (pk_live_...)."
      )
    }
    if (!isLiveStripeSecretKey(stripeSecret)) {
      pushError(
        errors,
        "STRIPE_SECRET_KEY (or PAYMENT_PROVIDER_SECRET) must be a live Stripe secret key (sk_live_... or rk_live_...)."
      )
    }
    if (!hasValue(env, "STRIPE_CONNECT_CLIENT_ID")) {
      pushError(
        errors,
        "STRIPE_CONNECT_CLIENT_ID is required for Stripe Connect."
      )
    } else if (
      looksPlaceholderValue(env.STRIPE_CONNECT_CLIENT_ID) ||
      !looksLikeStripeClientId(env.STRIPE_CONNECT_CLIENT_ID)
    ) {
      pushError(
        errors,
        "STRIPE_CONNECT_CLIENT_ID must be a real Stripe Connect client id (ca_...)."
      )
    }
    if (!hasValue(env, "STRIPE_CONNECT_OAUTH_REDIRECT_URI")) {
      pushError(
        errors,
        "STRIPE_CONNECT_OAUTH_REDIRECT_URI is required for Stripe Connect."
      )
    } else if (
      looksPlaceholderValue(env.STRIPE_CONNECT_OAUTH_REDIRECT_URI) ||
      !isHttpsUrl(env.STRIPE_CONNECT_OAUTH_REDIRECT_URI)
    ) {
      pushError(
        errors,
        "STRIPE_CONNECT_OAUTH_REDIRECT_URI must be a real https URL."
      )
    }
    if (!hasValue(env, "STRIPE_WEBHOOK_SECRET")) {
      pushError(
        errors,
        "STRIPE_WEBHOOK_SECRET is required for Stripe webhooks."
      )
    } else if (
      looksPlaceholderValue(env.STRIPE_WEBHOOK_SECRET) ||
      !looksLikeStripeWebhookSecret(env.STRIPE_WEBHOOK_SECRET)
    ) {
      pushError(
        errors,
        "STRIPE_WEBHOOK_SECRET must look like a Stripe webhook secret (whsec_...)."
      )
    }
    if (!hasValue(env, "STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID")) {
      pushError(
        errors,
        "STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID is required for Stripe Billing."
      )
    } else if (
      looksPlaceholderValue(env.STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID) ||
      !looksLikeStripePriceId(env.STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID)
    ) {
      pushError(
        errors,
        "STRIPE_PLATFORM_SUBSCRIPTION_PRICE_ID must look like a Stripe price id (price_...)."
      )
    }
  }

  if (isEnabled(env.ALLOW_SIMULATED_PAYMENTS)) {
    pushError(
      errors,
      "ALLOW_SIMULATED_PAYMENTS must be disabled in production."
    )
  }

  if (!isEnabled(env.ENABLE_SETUP_V2)) {
    pushError(errors, "ENABLE_SETUP_V2 should be true.")
  }
  if (!isEnabled(env.ENABLE_DURABLE_RUNTIME_REQUIRED)) {
    pushError(
      errors,
      "ENABLE_DURABLE_RUNTIME_REQUIRED should be true."
    )
  }
  if (!isEnabled(env.ENABLE_NAMED_STAFF_ACCOUNTS)) {
    pushError(
      errors,
      "ENABLE_NAMED_STAFF_ACCOUNTS should be true."
    )
  }
  if (!isEnabled(env.ENABLE_EXTERNAL_PAYMENTS_REQUIRED)) {
    pushError(
      errors,
      "ENABLE_EXTERNAL_PAYMENTS_REQUIRED should be true."
    )
  }
  if (isEnabled(env.ENABLE_DEMO_TOOLS)) {
    pushError(errors, "ENABLE_DEMO_TOOLS must be false.")
  }

  const rolePasscodeKeys = [
    "WAITER_PASSCODES",
    "BAR_PASSCODES",
    "KITCHEN_PASSCODES",
    "MANAGER_PASSCODES",
    "ADMIN_PASSCODES",
  ]

  const seenCodes = new Map()
  let totalCodes = 0
  for (const key of rolePasscodeKeys) {
    const codes = parseCodes(env[key])
    totalCodes += codes.length
    if (codes.length === 0) {
      pushWarning(
        warnings,
        `${key} is empty. Confirm that role login is intentionally disabled.`
      )
    }

    for (const code of codes) {
      if (!/^\d{4}$/.test(code)) {
        pushError(errors, `${key} contains a non-4-digit code.`)
        continue
      }
      if (WEAK_PASSCODES.has(code)) {
        pushError(
          errors,
          `${key} uses an obvious default/test passcode. Rotate it.`
        )
      }
      const existingKey = seenCodes.get(code)
      if (existingKey && existingKey !== key) {
        pushError(
          errors,
          `Passcode collision detected between ${existingKey} and ${key}.`
        )
      } else {
        seenCodes.set(code, key)
      }
    }
  }

  if (totalCodes === 0) {
    pushWarning(
      warnings,
      "No role passcodes are configured. Named accounts must be provisioned and tested separately."
    )
  }

  if (hasValue(env, "STAFF_AUTH_SECRET")) {
    const sharedSecret = String(env.STAFF_AUTH_SECRET).trim()
    if (sharedSecret.toLowerCase().includes("dev-")) {
      pushError(
        errors,
        "STAFF_AUTH_SECRET still uses a development value. Remove it or replace it."
      )
    } else {
      pushWarning(
        warnings,
        "STAFF_AUTH_SECRET is set. Prefer role-specific passcodes only in production."
      )
    }
  }

  const defaultSlug = String(env.DEFAULT_RESTAURANT_SLUG ?? "").trim()
  const salesDemoSlug = String(env.SALES_DEMO_SLUG ?? "").trim()
  if (!defaultSlug) {
    pushWarning(
      warnings,
      "DEFAULT_RESTAURANT_SLUG is not set. The app will fall back to demo-template."
    )
  } else if (
    defaultSlug === "demo" ||
    defaultSlug === "fable-stores"
  ) {
    pushWarning(
      warnings,
      "DEFAULT_RESTAURANT_SLUG still points to a legacy demo slug. Prefer a neutral tenant slug such as demo-template."
    )
  }

  if (!salesDemoSlug) {
    pushWarning(
      warnings,
      "SALES_DEMO_SLUG is not set. The app will fall back to sales-demo."
    )
  } else if (salesDemoSlug === defaultSlug) {
    pushError(
      errors,
      "SALES_DEMO_SLUG must differ from DEFAULT_RESTAURANT_SLUG so the dedicated sales simulator stays isolated."
    )
  }

  if (!hasValue(env, "NEXT_PUBLIC_SUPPORT_EMAIL")) {
    pushWarning(
      warnings,
      "NEXT_PUBLIC_SUPPORT_EMAIL is empty. Stripe review expects a real public contact channel."
    )
  }

  if (!hasValue(env, "NEXT_PUBLIC_SUPPORT_PHONE")) {
    pushWarning(
      warnings,
      "NEXT_PUBLIC_SUPPORT_PHONE is empty. Add a real public phone line before payment-provider review."
    )
  }

  if (hasValue(env, "VERCEL_OIDC_TOKEN")) {
    pushWarning(
      warnings,
      "VERCEL_OIDC_TOKEN is present in the env file. Do not treat exported ephemeral tokens as long-term config."
    )
  }

  return { errors, warnings }
}

function formatDbCheckMessage(error) {
  const message = String(error?.message ?? error ?? "").trim()
  if (!message) {
    return "Database connectivity check failed for DATABASE_URL."
  }

  const lower = message.toLowerCase()
  if (lower.includes("authentication failed")) {
    return "DATABASE_URL failed authentication against the database server."
  }
  if (lower.includes("timed out")) {
    return message
  }
  if (lower.includes("getaddrinfo")) {
    return "DATABASE_URL host could not be resolved. Check hostname and DNS reachability."
  }
  if (lower.includes("econnrefused")) {
    return "DATABASE_URL host refused the connection."
  }
  if (lower.includes("self signed certificate")) {
    return "DATABASE_URL SSL certificate validation failed."
  }
  return `DATABASE_URL connectivity check failed: ${message}`
}

async function verifyDatabaseConnectivity({
  env,
  errors,
  warnings,
  skipDbCheck,
}) {
  if (!hasValue(env, "DATABASE_URL")) {
    return
  }

  if (skipDbCheck) {
    pushWarning(
      warnings,
      "Database connectivity check was skipped (--skip-db-check)."
    )
    return
  }

  let PrismaClient
  try {
    ;({ PrismaClient } = await import("@prisma/client"))
  } catch {
    pushWarning(
      warnings,
      "Could not import @prisma/client for DATABASE_URL connectivity check."
    )
    return
  }

  const timeoutMs = Number(
    process.env.PROD_ENV_DB_TIMEOUT_MS ?? DEFAULT_DB_CHECK_TIMEOUT_MS
  )
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  })

  const timeoutPromise = new Promise((_, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Database connectivity check timed out after ${timeoutMs}ms.`
        )
      )
    }, timeoutMs)
    timer.unref?.()
  })

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      timeoutPromise,
    ])
  } catch (error) {
    pushError(errors, formatDbCheckMessage(error))
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

function printResults(filePath, results) {
  const relative = path.relative(process.cwd(), filePath) || filePath
  console.log(`[prod-env-preflight] ${relative}`)

  if (results.errors.length === 0 && results.warnings.length === 0) {
    console.log("PASS: no blocking issues detected.")
    return
  }

  if (results.errors.length > 0) {
    console.log("\nErrors:")
    for (const message of results.errors) {
      console.log(`- ${message}`)
    }
  }

  if (results.warnings.length > 0) {
    console.log("\nWarnings:")
    for (const message of results.warnings) {
      console.log(`- ${message}`)
    }
  }
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log(
      [
        "Usage:",
        "  node scripts/production-env-preflight.mjs [env-file]",
        "  node scripts/production-env-preflight.mjs --env-file <path>",
        "",
        "Flags:",
        "  --env-file <path>   Explicit env file path.",
        "  --skip-db-check     Skip live DATABASE_URL connectivity/auth check.",
        "",
        "Env vars:",
        `  PROD_ENV_DB_TIMEOUT_MS (default ${DEFAULT_DB_CHECK_TIMEOUT_MS})`,
        "",
        "Default env file:",
        `  ${DEFAULT_ENV_FILE}`,
      ].join("\n")
    )
    process.exit(0)
  }

  const skipDbCheck = process.argv.includes("--skip-db-check")
  const envFileFromFlag = getArgValue("--env-file")
  const envFileFromPositional = process.argv[2]?.startsWith("--")
    ? ""
    : process.argv[2]

  const target =
    envFileFromFlag ||
    envFileFromPositional ||
    process.env.QA_ENV_FILE ||
    DEFAULT_ENV_FILE
  const filePath = path.resolve(process.cwd(), target)
  const env = parseEnvFile(filePath)
  const results = validateEnv(env)
  await verifyDatabaseConnectivity({
    env,
    errors: results.errors,
    warnings: results.warnings,
    skipDbCheck,
  })
  printResults(filePath, results)
  process.exit(results.errors.length > 0 ? 1 : 0)
}

try {
  main()
} catch (error) {
  console.error((error && error.message) || String(error))
  process.exit(1)
}
