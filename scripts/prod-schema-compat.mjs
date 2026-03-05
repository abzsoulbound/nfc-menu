import fs from "node:fs"
import path from "node:path"
import { PrismaClient } from "@prisma/client"

const DEFAULT_ENV_FILE = ".env.neoncheck.production"

function usage() {
  console.log(
    [
      "Usage:",
      "  node scripts/prod-schema-compat.mjs [--env-file <path>]",
      "",
      "Purpose:",
      "  Non-destructive compatibility hotfix for legacy production databases.",
      "  Adds missing Restaurant columns and runtime billing/setup tables used by the app.",
      "",
      "Default env file:",
      `  ${DEFAULT_ENV_FILE}`,
    ].join("\n")
  )
}

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

function resolveEnvFile() {
  const fromFlag = getArgValue("--env-file")
  const fromPositional = process.argv[2]?.startsWith("--")
    ? ""
    : process.argv[2]
  const fromEnv = process.env.QA_ENV_FILE?.trim() ?? ""
  const selected =
    fromFlag ||
    fromPositional ||
    fromEnv ||
    DEFAULT_ENV_FILE
  return path.resolve(process.cwd(), selected)
}

async function runSql(prisma, label, sql) {
  await prisma.$executeRawUnsafe(sql)
  console.log(`[schema-compat] ${label}`)
}

async function ensureRestaurantColumns(prisma) {
  const addColumnStatements = [
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "monogram" TEXT`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "location" TEXT`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "heroUrl" TEXT`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "experienceConfig" JSONB`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "stripeAccountId" TEXT`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "stripeAccountStatus" TEXT`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "stripeChargesEnabled" BOOLEAN`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "stripePayoutsEnabled" BOOLEAN`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "stripeDetailsSubmitted" BOOLEAN`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "platformFeeBps" INTEGER`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "staffAuth" JSONB`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "staffAccounts" JSONB`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "planTier" TEXT`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "billingStatus" TEXT`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "onboardingChecklist" JSONB`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "onboardingScore" INTEGER`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "active" BOOLEAN`,
  ]

  for (const [index, sql] of addColumnStatements.entries()) {
    await runSql(
      prisma,
      `Restaurant column patch ${index + 1}/${addColumnStatements.length}`,
      sql
    )
  }

  const backfillStatements = [
    `UPDATE "Restaurant" SET "monogram" = 'RM' WHERE "monogram" IS NULL OR BTRIM("monogram") = ''`,
    `UPDATE "Restaurant" SET "stripeAccountStatus" = 'DISCONNECTED' WHERE "stripeAccountStatus" IS NULL OR BTRIM("stripeAccountStatus") = ''`,
    `UPDATE "Restaurant" SET "stripeChargesEnabled" = FALSE WHERE "stripeChargesEnabled" IS NULL`,
    `UPDATE "Restaurant" SET "stripePayoutsEnabled" = FALSE WHERE "stripePayoutsEnabled" IS NULL`,
    `UPDATE "Restaurant" SET "stripeDetailsSubmitted" = FALSE WHERE "stripeDetailsSubmitted" IS NULL`,
    `UPDATE "Restaurant" SET "platformFeeBps" = 0 WHERE "platformFeeBps" IS NULL`,
    `UPDATE "Restaurant" SET "subscriptionStatus" = 'TRIALING' WHERE "subscriptionStatus" IS NULL OR BTRIM("subscriptionStatus") = ''`,
    `UPDATE "Restaurant" SET "staffAuth" = '{}'::jsonb WHERE "staffAuth" IS NULL`,
    `UPDATE "Restaurant" SET "planTier" = 'starter' WHERE "planTier" IS NULL OR BTRIM("planTier") = ''`,
    `UPDATE "Restaurant" SET "billingStatus" = 'trial' WHERE "billingStatus" IS NULL OR BTRIM("billingStatus") = ''`,
    `UPDATE "Restaurant" SET "onboardingScore" = 0 WHERE "onboardingScore" IS NULL`,
    `UPDATE "Restaurant" SET "isDemo" = FALSE WHERE "isDemo" IS NULL`,
    `UPDATE "Restaurant" SET "active" = TRUE WHERE "active" IS NULL`,
  ]

  for (const [index, sql] of backfillStatements.entries()) {
    await runSql(
      prisma,
      `Restaurant backfill ${index + 1}/${backfillStatements.length}`,
      sql
    )
  }

  const constraintStatements = [
    `ALTER TABLE "Restaurant" ALTER COLUMN "monogram" SET DEFAULT 'RM'`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "monogram" SET NOT NULL`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "stripeAccountStatus" SET DEFAULT 'DISCONNECTED'`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "stripeAccountStatus" SET NOT NULL`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "stripeChargesEnabled" SET DEFAULT FALSE`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "stripeChargesEnabled" SET NOT NULL`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "stripePayoutsEnabled" SET DEFAULT FALSE`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "stripePayoutsEnabled" SET NOT NULL`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "stripeDetailsSubmitted" SET DEFAULT FALSE`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "stripeDetailsSubmitted" SET NOT NULL`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "platformFeeBps" SET DEFAULT 0`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "platformFeeBps" SET NOT NULL`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "subscriptionStatus" SET DEFAULT 'TRIALING'`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "subscriptionStatus" SET NOT NULL`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "staffAuth" SET DEFAULT '{}'::jsonb`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "staffAuth" SET NOT NULL`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "planTier" SET DEFAULT 'starter'`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "planTier" SET NOT NULL`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "billingStatus" SET DEFAULT 'trial'`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "billingStatus" SET NOT NULL`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "onboardingScore" SET DEFAULT 0`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "onboardingScore" SET NOT NULL`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "isDemo" SET DEFAULT FALSE`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "isDemo" SET NOT NULL`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "active" SET DEFAULT TRUE`,
    `ALTER TABLE "Restaurant" ALTER COLUMN "active" SET NOT NULL`,
  ]

  for (const [index, sql] of constraintStatements.entries()) {
    await runSql(
      prisma,
      `Restaurant constraints ${index + 1}/${constraintStatements.length}`,
      sql
    )
  }
}

async function ensureRuntimeTables(prisma) {
  await runSql(
    prisma,
    "History table",
    `CREATE TABLE IF NOT EXISTS "History" (
      "id" TEXT NOT NULL,
      "data" JSONB NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "History_pkey" PRIMARY KEY ("id")
    )`
  )

  await runSql(
    prisma,
    "RestaurantSetupToken table",
    `CREATE TABLE IF NOT EXISTS "RestaurantSetupToken" (
      "id" TEXT NOT NULL,
      "tokenHash" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "consumedAt" TIMESTAMP(3),
      "createdBy" TEXT,
      "bootstrap" JSONB,
      "uses" INTEGER NOT NULL DEFAULT 0,
      "restaurantId" TEXT,
      CONSTRAINT "RestaurantSetupToken_pkey" PRIMARY KEY ("id")
    )`
  )
  await runSql(
    prisma,
    "RestaurantSetupToken tokenHash unique index",
    `CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantSetupToken_tokenHash_key" ON "RestaurantSetupToken"("tokenHash")`
  )
  await runSql(
    prisma,
    "RestaurantSetupToken restaurantId index",
    `CREATE INDEX IF NOT EXISTS "RestaurantSetupToken_restaurantId_idx" ON "RestaurantSetupToken"("restaurantId")`
  )
  await runSql(
    prisma,
    "RestaurantSetupToken foreign key",
    `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'RestaurantSetupToken_restaurantId_fkey'
      ) THEN
        ALTER TABLE "RestaurantSetupToken"
        ADD CONSTRAINT "RestaurantSetupToken_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$`
  )

  await runSql(
    prisma,
    "PaymentLedgerEvent table",
    `CREATE TABLE IF NOT EXISTS "PaymentLedgerEvent" (
      "id" TEXT NOT NULL,
      "restaurantSlug" TEXT NOT NULL,
      "tableNumber" INTEGER NOT NULL,
      "receiptId" TEXT,
      "eventType" TEXT NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'GBP',
      "method" TEXT,
      "provider" TEXT,
      "providerRef" TEXT,
      "reason" TEXT,
      "actorRole" TEXT,
      "actorId" TEXT,
      "metadata" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PaymentLedgerEvent_pkey" PRIMARY KEY ("id")
    )`
  )
  await runSql(
    prisma,
    "PaymentLedgerEvent index by restaurant and time",
    `CREATE INDEX IF NOT EXISTS "PaymentLedgerEvent_restaurantSlug_createdAt_idx" ON "PaymentLedgerEvent"("restaurantSlug", "createdAt")`
  )
  await runSql(
    prisma,
    "PaymentLedgerEvent index by receipt",
    `CREATE INDEX IF NOT EXISTS "PaymentLedgerEvent_receiptId_idx" ON "PaymentLedgerEvent"("receiptId")`
  )

  await runSql(
    prisma,
    "StripeWebhookEvent table",
    `CREATE TABLE IF NOT EXISTS "StripeWebhookEvent" (
      "eventId" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("eventId")
    )`
  )

  await runSql(
    prisma,
    "StripeOrderPayment table",
    `CREATE TABLE IF NOT EXISTS "StripeOrderPayment" (
      "id" TEXT NOT NULL,
      "orderId" TEXT NOT NULL,
      "restaurantSlug" TEXT NOT NULL,
      "stripeAccountId" TEXT NOT NULL,
      "checkoutSessionId" TEXT,
      "paymentIntentId" TEXT,
      "checkoutStatus" TEXT NOT NULL DEFAULT 'CREATED',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StripeOrderPayment_pkey" PRIMARY KEY ("id")
    )`
  )
  await runSql(
    prisma,
    "StripeOrderPayment order unique index",
    `CREATE UNIQUE INDEX IF NOT EXISTS "StripeOrderPayment_orderId_key" ON "StripeOrderPayment"("orderId")`
  )
  await runSql(
    prisma,
    "StripeOrderPayment restaurant-time index",
    `CREATE INDEX IF NOT EXISTS "StripeOrderPayment_restaurantSlug_createdAt_idx" ON "StripeOrderPayment"("restaurantSlug", "createdAt")`
  )
  await runSql(
    prisma,
    "StripeOrderPayment checkoutSession index",
    `CREATE INDEX IF NOT EXISTS "StripeOrderPayment_checkoutSessionId_idx" ON "StripeOrderPayment"("checkoutSessionId")`
  )
  await runSql(
    prisma,
    "StripeOrderPayment paymentIntent index",
    `CREATE INDEX IF NOT EXISTS "StripeOrderPayment_paymentIntentId_idx" ON "StripeOrderPayment"("paymentIntentId")`
  )

  await runSql(
    prisma,
    "StripeConnectSampleSeller table",
    `CREATE TABLE IF NOT EXISTS "StripeConnectSampleSeller" (
      "id" TEXT NOT NULL,
      "displayName" TEXT NOT NULL,
      "contactEmail" TEXT NOT NULL,
      "stripeAccountId" TEXT NOT NULL,
      "country" TEXT NOT NULL DEFAULT 'us',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StripeConnectSampleSeller_pkey" PRIMARY KEY ("id")
    )`
  )
  await runSql(
    prisma,
    "StripeConnectSampleSeller stripe account unique index",
    `CREATE UNIQUE INDEX IF NOT EXISTS "StripeConnectSampleSeller_stripeAccountId_key" ON "StripeConnectSampleSeller"("stripeAccountId")`
  )

  await runSql(
    prisma,
    "StripeConnectSampleProduct table",
    `CREATE TABLE IF NOT EXISTS "StripeConnectSampleProduct" (
      "id" TEXT NOT NULL,
      "sellerId" TEXT NOT NULL,
      "stripeProductId" TEXT NOT NULL,
      "stripePriceId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "unitAmount" INTEGER NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'usd',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StripeConnectSampleProduct_pkey" PRIMARY KEY ("id")
    )`
  )
  await runSql(
    prisma,
    "StripeConnectSampleProduct stripe product unique index",
    `CREATE UNIQUE INDEX IF NOT EXISTS "StripeConnectSampleProduct_stripeProductId_key" ON "StripeConnectSampleProduct"("stripeProductId")`
  )
  await runSql(
    prisma,
    "StripeConnectSampleProduct seller-time index",
    `CREATE INDEX IF NOT EXISTS "StripeConnectSampleProduct_sellerId_createdAt_idx" ON "StripeConnectSampleProduct"("sellerId", "createdAt")`
  )
  await runSql(
    prisma,
    "StripeConnectSampleProduct foreign key",
    `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'StripeConnectSampleProduct_sellerId_fkey'
      ) THEN
        ALTER TABLE "StripeConnectSampleProduct"
        ADD CONSTRAINT "StripeConnectSampleProduct_sellerId_fkey"
        FOREIGN KEY ("sellerId") REFERENCES "StripeConnectSampleSeller"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$`
  )
}

async function main() {
  if (process.argv.includes("--help")) {
    usage()
    process.exit(0)
  }

  const envFile = resolveEnvFile()
  const envValues = parseEnvFile(envFile)
  const databaseUrl = String(envValues.DATABASE_URL ?? "").trim()
  if (!databaseUrl) {
    throw new Error(
      `DATABASE_URL is missing in env file: ${envFile}`
    )
  }

  console.log(`[schema-compat] ENV_FILE=${envFile}`)

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })

  try {
    await ensureRestaurantColumns(prisma)
    await ensureRuntimeTables(prisma)
    console.log(
      "[schema-compat] PASS: compatibility schema patch completed."
    )
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main().catch(error => {
  console.error(error?.message ?? String(error))
  process.exit(1)
})
