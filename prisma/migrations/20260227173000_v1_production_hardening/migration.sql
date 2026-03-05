ALTER TABLE "Restaurant"
  ADD COLUMN IF NOT EXISTS "staffAccounts" JSONB,
  ADD COLUMN IF NOT EXISTS "planTier" TEXT NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS "billingStatus" TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS "onboardingChecklist" JSONB,
  ADD COLUMN IF NOT EXISTS "onboardingScore" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "RestaurantSetupToken"
  ADD COLUMN IF NOT EXISTS "bootstrap" JSONB,
  ADD COLUMN IF NOT EXISTS "uses" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "PaymentLedgerEvent" (
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
);

CREATE INDEX IF NOT EXISTS "PaymentLedgerEvent_restaurantSlug_createdAt_idx"
  ON "PaymentLedgerEvent"("restaurantSlug", "createdAt");

CREATE INDEX IF NOT EXISTS "PaymentLedgerEvent_receiptId_idx"
  ON "PaymentLedgerEvent"("receiptId");
