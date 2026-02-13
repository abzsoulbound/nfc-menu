CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Restaurant" WHERE "id" = 'marlos')
     AND NOT EXISTS (SELECT 1 FROM "Restaurant" WHERE "id" = 'rest_marlos') THEN
    UPDATE "Restaurant"
    SET "id" = 'rest_marlos',
        "name" = 'Marlo''s Brasserie'
    WHERE "id" = 'marlos';
  END IF;
END $$;

UPDATE "Restaurant"
SET "name" = 'Marlo''s Brasserie'
WHERE "slug" = 'marlos';

ALTER TABLE "NfcTag" ALTER COLUMN "restaurantId" DROP DEFAULT;
ALTER TABLE "TableAssignment" ALTER COLUMN "restaurantId" DROP DEFAULT;
ALTER TABLE "Session" ALTER COLUMN "restaurantId" DROP DEFAULT;
ALTER TABLE "SessionCart" ALTER COLUMN "restaurantId" DROP DEFAULT;
ALTER TABLE "CartItem" ALTER COLUMN "restaurantId" DROP DEFAULT;
ALTER TABLE "TableDraft" ALTER COLUMN "restaurantId" DROP DEFAULT;
ALTER TABLE "DraftItem" ALTER COLUMN "restaurantId" DROP DEFAULT;
ALTER TABLE "KitchenTicket" ALTER COLUMN "restaurantId" DROP DEFAULT;
ALTER TABLE "TicketItem" ALTER COLUMN "restaurantId" DROP DEFAULT;
ALTER TABLE "MenuCategory" ALTER COLUMN "restaurantId" DROP DEFAULT;
ALTER TABLE "MenuItem" ALTER COLUMN "restaurantId" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "restaurantId" DROP DEFAULT;
ALTER TABLE "OrderItem" ALTER COLUMN "restaurantId" DROP DEFAULT;
ALTER TABLE "DeviceSession" ALTER COLUMN "restaurantId" DROP DEFAULT;
ALTER TABLE "StaffUser" ALTER COLUMN "restaurantId" DROP DEFAULT;
ALTER TABLE "SystemEvent" ALTER COLUMN "restaurantId" DROP DEFAULT;

ALTER TABLE "NfcTag" ADD COLUMN IF NOT EXISTS "tagId" TEXT;
UPDATE "NfcTag" SET "tagId" = "id" WHERE "tagId" IS NULL;
ALTER TABLE "NfcTag" ALTER COLUMN "tagId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "NfcTag_restaurantId_tagId_idx" ON "NfcTag"("restaurantId", "tagId");
CREATE INDEX IF NOT EXISTS "NfcTag_tagId_idx" ON "NfcTag"("tagId");
CREATE UNIQUE INDEX IF NOT EXISTS "NfcTag_restaurantId_tagId_key" ON "NfcTag"("restaurantId", "tagId");

ALTER TABLE "TableAssignment" ADD COLUMN IF NOT EXISTS "nfcTagId" TEXT;

INSERT INTO "NfcTag" ("id", "tagId", "restaurantId", "createdAt")
SELECT gen_random_uuid()::text, ta."tagId", ta."restaurantId", CURRENT_TIMESTAMP
FROM "TableAssignment" ta
LEFT JOIN "NfcTag" nt
  ON nt."restaurantId" = ta."restaurantId"
 AND nt."tagId" = ta."tagId"
WHERE nt."id" IS NULL;

UPDATE "TableAssignment" ta
SET "nfcTagId" = nt."id"
FROM "NfcTag" nt
WHERE nt."restaurantId" = ta."restaurantId"
  AND nt."tagId" = ta."tagId"
  AND ta."nfcTagId" IS NULL;

ALTER TABLE "TableAssignment" ALTER COLUMN "nfcTagId" SET NOT NULL;

ALTER TABLE "TableAssignment" DROP CONSTRAINT IF EXISTS "TableAssignment_tagId_fkey";
DROP INDEX IF EXISTS "TableAssignment_tagId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "TableAssignment_nfcTagId_key" ON "TableAssignment"("nfcTagId");
CREATE UNIQUE INDEX IF NOT EXISTS "TableAssignment_restaurantId_tagId_key" ON "TableAssignment"("restaurantId", "tagId");
CREATE INDEX IF NOT EXISTS "TableAssignment_restaurantId_tableNo_idx" ON "TableAssignment"("restaurantId", "tableNo");

ALTER TABLE "TableAssignment"
  ADD CONSTRAINT "TableAssignment_nfcTagId_fkey"
  FOREIGN KEY ("nfcTagId") REFERENCES "NfcTag"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "nfcTagId" TEXT;

INSERT INTO "NfcTag" ("id", "tagId", "restaurantId", "createdAt")
SELECT gen_random_uuid()::text, s."tagId", s."restaurantId", CURRENT_TIMESTAMP
FROM "Session" s
LEFT JOIN "NfcTag" nt
  ON nt."restaurantId" = s."restaurantId"
 AND nt."tagId" = s."tagId"
WHERE nt."id" IS NULL;

UPDATE "Session" s
SET "nfcTagId" = nt."id"
FROM "NfcTag" nt
WHERE nt."restaurantId" = s."restaurantId"
  AND nt."tagId" = s."tagId"
  AND s."nfcTagId" IS NULL;

ALTER TABLE "Session" ALTER COLUMN "nfcTagId" SET NOT NULL;
ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_tagId_fkey";
ALTER TABLE "Session"
  ADD CONSTRAINT "Session_nfcTagId_fkey"
  FOREIGN KEY ("nfcTagId") REFERENCES "NfcTag"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Session_tagId_status_idx";
CREATE INDEX IF NOT EXISTS "Session_restaurantId_tagId_status_idx" ON "Session"("restaurantId", "tagId", "status");
CREATE INDEX IF NOT EXISTS "Session_nfcTagId_status_idx" ON "Session"("nfcTagId", "status");

ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "sku" TEXT;
UPDATE "MenuItem" SET "sku" = "id" WHERE "sku" IS NULL;
ALTER TABLE "MenuItem" ALTER COLUMN "sku" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "MenuItem_restaurantId_sku_key" ON "MenuItem"("restaurantId", "sku");

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_restaurantId_clientRequestId_key" ON "Order"("restaurantId", "clientRequestId");

ALTER TABLE "KitchenTicket" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE "KitchenTicket" ADD COLUMN IF NOT EXISTS "station" TEXT NOT NULL DEFAULT 'KITCHEN';
ALTER TABLE "KitchenTicket" ADD COLUMN IF NOT EXISTS "status" "OrderStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "KitchenTicket" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "KitchenTicket_restaurantId_station_status_createdAt_idx" ON "KitchenTicket"("restaurantId", "station", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "KitchenTicket_orderId_idx" ON "KitchenTicket"("orderId");
ALTER TABLE "KitchenTicket"
  ADD CONSTRAINT "KitchenTicket_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketItem" ADD COLUMN IF NOT EXISTS "orderItemId" TEXT;
ALTER TABLE "TicketItem" ADD COLUMN IF NOT EXISTS "status" "OrderStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "TicketItem" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TicketItem" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "TicketItem_ticketId_idx" ON "TicketItem"("ticketId");
CREATE INDEX IF NOT EXISTS "TicketItem_orderItemId_idx" ON "TicketItem"("orderItemId");
CREATE INDEX IF NOT EXISTS "TicketItem_restaurantId_station_status_idx" ON "TicketItem"("restaurantId", "station", "status");
ALTER TABLE "TicketItem"
  ADD CONSTRAINT "TicketItem_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffUser" ADD COLUMN IF NOT EXISTS "passcodeHash" TEXT;
ALTER TABLE "StaffUser" ADD COLUMN IF NOT EXISTS "passcodeUpdatedAt" TIMESTAMP(3);
UPDATE "StaffUser"
SET "passcodeUpdatedAt" = COALESCE("passcodeUpdatedAt", CURRENT_TIMESTAMP)
WHERE "passcode" IS NOT NULL;
ALTER TABLE "StaffUser" DROP COLUMN IF EXISTS "passcode";

CREATE TABLE IF NOT EXISTS "StaffSession" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "staffUserId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3),
  "ip" TEXT,
  "userAgent" TEXT,
  "deviceLabel" TEXT,
  CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StaffLoginAttempt" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "ip" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "success" BOOLEAN NOT NULL,
  CONSTRAINT "StaffLoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StaffSession_restaurantId_staffUserId_idx" ON "StaffSession"("restaurantId", "staffUserId");
CREATE INDEX IF NOT EXISTS "StaffSession_expiresAt_idx" ON "StaffSession"("expiresAt");
CREATE INDEX IF NOT EXISTS "StaffSession_tokenHash_idx" ON "StaffSession"("tokenHash");

CREATE INDEX IF NOT EXISTS "StaffLoginAttempt_restaurantId_identifier_ip_createdAt_idx" ON "StaffLoginAttempt"("restaurantId", "identifier", "ip", "createdAt");
CREATE INDEX IF NOT EXISTS "StaffLoginAttempt_createdAt_idx" ON "StaffLoginAttempt"("createdAt");

ALTER TABLE "StaffSession"
  ADD CONSTRAINT "StaffSession_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffSession"
  ADD CONSTRAINT "StaffSession_staffUserId_fkey"
  FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffLoginAttempt"
  ADD CONSTRAINT "StaffLoginAttempt_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Table" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "tableNumber" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Table_restaurantId_tableNumber_key" ON "Table"("restaurantId", "tableNumber");
CREATE INDEX IF NOT EXISTS "Table_restaurantId_idx" ON "Table"("restaurantId");

ALTER TABLE "Table"
  ADD CONSTRAINT "Table_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Table" ("id", "restaurantId", "tableNumber", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text,
       ta."restaurantId",
       ta."tableNo",
       MIN(ta."createdAt") AS "createdAt",
       CURRENT_TIMESTAMP
FROM "TableAssignment" ta
GROUP BY ta."restaurantId", ta."tableNo"
ON CONFLICT ("restaurantId", "tableNumber") DO NOTHING;
