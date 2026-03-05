-- Runtime relational persistence enums
DO $$ BEGIN
  CREATE TYPE "TableBillStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'UNPAID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PrintJobStatus" AS ENUM ('QUEUED', 'PRINTED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Runtime metadata
CREATE TABLE IF NOT EXISTS "RuntimeMeta" (
  "id" TEXT NOT NULL,
  "menu" JSONB NOT NULL,
  "flags" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RuntimeMeta_pkey" PRIMARY KEY ("id")
);

-- Runtime entities
CREATE TABLE IF NOT EXISTS "RuntimeTableState" (
  "id" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "locked" BOOLEAN NOT NULL,
  "stale" BOOLEAN NOT NULL,
  "closeStatus" "TableCloseStatus" NOT NULL,
  "billStatus" "TableBillStatus" NOT NULL DEFAULT 'OPEN',
  "splitCount" INTEGER NOT NULL DEFAULT 1,
  "openedAt" TIMESTAMP(3) NOT NULL,
  "contributionWindowEndsAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RuntimeTableState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RuntimeTableState_number_key"
  ON "RuntimeTableState"("number");

CREATE TABLE IF NOT EXISTS "RuntimeTagState" (
  "id" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL,
  "tableId" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RuntimeTagState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RuntimeSessionState" (
  "id" TEXT NOT NULL,
  "origin" "SessionOrigin" NOT NULL,
  "tagId" TEXT,
  "tableId" TEXT,
  "lastActivityAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RuntimeSessionState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RuntimeOrderState" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "tableId" TEXT NOT NULL,
  "tableNumber" INTEGER NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RuntimeOrderState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RuntimeOrderLineState" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "edits" JSONB,
  "allergens" JSONB,
  "unitPrice" DOUBLE PRECISION NOT NULL,
  "vatRate" DOUBLE PRECISION NOT NULL,
  "station" "Station" NOT NULL,
  "kitchenStartedAt" TIMESTAMP(3),
  "kitchenSentAt" TIMESTAMP(3),
  "barStartedAt" TIMESTAMP(3),
  "barSentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "compedAt" TIMESTAMP(3),
  "compReason" TEXT,
  "refireOfLineId" TEXT,
  CONSTRAINT "RuntimeOrderLineState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RuntimeStaffMessageState" (
  "id" TEXT NOT NULL,
  "tableId" TEXT NOT NULL,
  "target" "Station" NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RuntimeStaffMessageState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RuntimeReprintState" (
  "id" TEXT NOT NULL,
  "tableNumber" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RuntimeReprintState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RuntimePaymentState" (
  "id" TEXT NOT NULL,
  "tableId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "method" TEXT NOT NULL,
  "status" "TableBillStatus" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RuntimePaymentState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RuntimePrintJobState" (
  "id" TEXT NOT NULL,
  "tableNumber" INTEGER NOT NULL,
  "station" "Station" NOT NULL,
  "status" "PrintJobStatus" NOT NULL,
  "attempts" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RuntimePrintJobState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RuntimeAuditState" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "actorRole" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "note" TEXT,
  CONSTRAINT "RuntimeAuditState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RuntimeIdempotencyState" (
  "key" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "responseJson" JSONB NOT NULL,
  CONSTRAINT "RuntimeIdempotencyState_pkey" PRIMARY KEY ("key")
);

DO $$ BEGIN
  ALTER TABLE "RuntimeOrderLineState"
    ADD CONSTRAINT "RuntimeOrderLineState_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "RuntimeOrderState"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
