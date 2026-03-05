-- Sample Stripe Connect sellers map the local "user" record to the connected account id.
CREATE TABLE "StripeConnectSampleSeller" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "stripeAccountId" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'us',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeConnectSampleSeller_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StripeConnectSampleSeller_stripeAccountId_key"
ON "StripeConnectSampleSeller"("stripeAccountId");

-- Products are created on the platform account, but we persist which connected
-- seller should receive the destination charge for the storefront purchase.
CREATE TABLE "StripeConnectSampleProduct" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "stripeProductId" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unitAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeConnectSampleProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StripeConnectSampleProduct_stripeProductId_key"
ON "StripeConnectSampleProduct"("stripeProductId");

CREATE INDEX "StripeConnectSampleProduct_sellerId_createdAt_idx"
ON "StripeConnectSampleProduct"("sellerId", "createdAt");

ALTER TABLE "StripeConnectSampleProduct"
ADD CONSTRAINT "StripeConnectSampleProduct_sellerId_fkey"
FOREIGN KEY ("sellerId") REFERENCES "StripeConnectSampleSeller"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
