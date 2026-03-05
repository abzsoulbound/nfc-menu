ALTER TABLE "Restaurant"
ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "stripeSubscriptionId" TEXT,
ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'TRIALING';
