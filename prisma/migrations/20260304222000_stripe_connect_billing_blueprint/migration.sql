CREATE TABLE "StripeWebhookEvent" (
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("eventId")
);

CREATE TABLE "StripeOrderPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "restaurantSlug" TEXT NOT NULL,
    "stripeAccountId" TEXT NOT NULL,
    "checkoutSessionId" TEXT,
    "paymentIntentId" TEXT,
    "checkoutStatus" TEXT NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeOrderPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StripeOrderPayment_orderId_key"
ON "StripeOrderPayment"("orderId");

CREATE INDEX "StripeOrderPayment_restaurantSlug_createdAt_idx"
ON "StripeOrderPayment"("restaurantSlug", "createdAt");

CREATE INDEX "StripeOrderPayment_checkoutSessionId_idx"
ON "StripeOrderPayment"("checkoutSessionId");

CREATE INDEX "StripeOrderPayment_paymentIntentId_idx"
ON "StripeOrderPayment"("paymentIntentId");
