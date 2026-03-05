-- Enums
DO $$ BEGIN
  CREATE TYPE "SessionOrigin" AS ENUM ('CUSTOMER', 'STAFF');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "Station" AS ENUM ('KITCHEN', 'BAR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TableCloseStatus" AS ENUM ('OPEN', 'PAID', 'UNPAID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Core tables
CREATE TABLE IF NOT EXISTS "History" (
  "id" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "History_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Table" (
  "id" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "locked" BOOLEAN NOT NULL DEFAULT false,
  "stale" BOOLEAN NOT NULL DEFAULT false,
  "closeStatus" "TableCloseStatus" NOT NULL DEFAULT 'OPEN',
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "contributionWindowEndsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Table_number_key" ON "Table"("number");

ALTER TABLE "NfcTag" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NfcTag" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "NfcTag" ADD COLUMN IF NOT EXISTS "tableId" TEXT;

CREATE INDEX IF NOT EXISTS "NfcTag_tableId_idx" ON "NfcTag"("tableId");

ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "origin" "SessionOrigin" NOT NULL DEFAULT 'CUSTOMER';
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "tableId" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "Session_lastActivityAt_idx" ON "Session"("lastActivityAt");

CREATE TABLE IF NOT EXISTS "Order" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "tableId" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Order_tableId_submittedAt_idx" ON "Order"("tableId", "submittedAt");

CREATE TABLE IF NOT EXISTS "OrderItem" (
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
  "kitchenSentAt" TIMESTAMP(3),
  "barSentAt" TIMESTAMP(3),
  CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrderItem_station_kitchenSentAt_idx" ON "OrderItem"("station", "kitchenSentAt");
CREATE INDEX IF NOT EXISTS "OrderItem_station_barSentAt_idx" ON "OrderItem"("station", "barSentAt");

CREATE TABLE IF NOT EXISTS "StaffMessage" (
  "id" TEXT NOT NULL,
  "tableId" TEXT NOT NULL,
  "target" "Station" NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffMessage_pkey" PRIMARY KEY ("id")
);

-- FKs
DO $$ BEGIN
  ALTER TABLE "NfcTag"
    ADD CONSTRAINT "NfcTag_tableId_fkey"
    FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Session"
    ADD CONSTRAINT "Session_tableId_fkey"
    FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Order"
    ADD CONSTRAINT "Order_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Order"
    ADD CONSTRAINT "Order_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "NfcTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Order"
    ADD CONSTRAINT "Order_tableId_fkey"
    FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "StaffMessage"
    ADD CONSTRAINT "StaffMessage_tableId_fkey"
    FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
