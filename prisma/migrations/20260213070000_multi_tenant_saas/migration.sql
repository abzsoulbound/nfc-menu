-- DropIndex
DROP INDEX "MenuCategory_slug_key";

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "restaurantId" TEXT NOT NULL DEFAULT 'marlos';

-- AlterTable
ALTER TABLE "DeviceSession" ADD COLUMN     "restaurantId" TEXT NOT NULL DEFAULT 'marlos';

-- AlterTable
ALTER TABLE "DraftItem" ADD COLUMN     "restaurantId" TEXT NOT NULL DEFAULT 'marlos';

-- AlterTable
ALTER TABLE "KitchenTicket" ADD COLUMN     "restaurantId" TEXT NOT NULL DEFAULT 'marlos';

-- AlterTable
ALTER TABLE "MenuCategory" ADD COLUMN     "restaurantId" TEXT NOT NULL DEFAULT 'marlos';

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "restaurantId" TEXT NOT NULL DEFAULT 'marlos';

-- AlterTable
ALTER TABLE "NfcTag" ADD COLUMN     "restaurantId" TEXT NOT NULL DEFAULT 'marlos';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "restaurantId" TEXT NOT NULL DEFAULT 'marlos';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "restaurantId" TEXT NOT NULL DEFAULT 'marlos';

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "restaurantId" TEXT NOT NULL DEFAULT 'marlos';

-- AlterTable
ALTER TABLE "SessionCart" ADD COLUMN     "restaurantId" TEXT NOT NULL DEFAULT 'marlos';

-- AlterTable
ALTER TABLE "SystemEvent" ADD COLUMN     "restaurantId" TEXT NOT NULL DEFAULT 'marlos';

-- AlterTable
ALTER TABLE "TableAssignment" ADD COLUMN     "restaurantId" TEXT NOT NULL DEFAULT 'marlos';

-- AlterTable
ALTER TABLE "TableDraft" ADD COLUMN     "restaurantId" TEXT NOT NULL DEFAULT 'marlos';

-- AlterTable
ALTER TABLE "TicketItem" ADD COLUMN     "restaurantId" TEXT NOT NULL DEFAULT 'marlos';

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "domain" TEXT,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "serviceCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- Seed default tenant so existing rows with default restaurantId remain valid
INSERT INTO "Restaurant" (
    "id",
    "slug",
    "name",
    "logoUrl",
    "primaryColor",
    "secondaryColor",
    "domain",
    "vatRate",
    "serviceCharge",
    "createdAt",
    "updatedAt"
) VALUES (
    'marlos',
    'marlos',
    'Marlo''s Kitchen',
    '/images/marlos-wordmark-alpha.svg',
    '#12649a',
    '#d5e4ee',
    NULL,
    0.2,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

-- CreateTable
CREATE TABLE "StaffUser" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL DEFAULT 'marlos',
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "passcode" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_domain_key" ON "Restaurant"("domain");

-- CreateIndex
CREATE INDEX "StaffUser_restaurantId_role_idx" ON "StaffUser"("restaurantId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_restaurantId_name_key" ON "StaffUser"("restaurantId", "name");

-- CreateIndex
CREATE INDEX "CartItem_restaurantId_idx" ON "CartItem"("restaurantId");

-- CreateIndex
CREATE INDEX "DeviceSession_restaurantId_idx" ON "DeviceSession"("restaurantId");

-- CreateIndex
CREATE INDEX "DraftItem_restaurantId_idx" ON "DraftItem"("restaurantId");

-- CreateIndex
CREATE INDEX "KitchenTicket_restaurantId_idx" ON "KitchenTicket"("restaurantId");

-- CreateIndex
CREATE INDEX "MenuCategory_restaurantId_idx" ON "MenuCategory"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuCategory_restaurantId_slug_key" ON "MenuCategory"("restaurantId", "slug");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_idx" ON "MenuItem"("restaurantId");

-- CreateIndex
CREATE INDEX "NfcTag_restaurantId_idx" ON "NfcTag"("restaurantId");

-- CreateIndex
CREATE INDEX "Order_restaurantId_idx" ON "Order"("restaurantId");

-- CreateIndex
CREATE INDEX "OrderItem_restaurantId_idx" ON "OrderItem"("restaurantId");

-- CreateIndex
CREATE INDEX "Session_restaurantId_idx" ON "Session"("restaurantId");

-- CreateIndex
CREATE INDEX "SessionCart_restaurantId_idx" ON "SessionCart"("restaurantId");

-- CreateIndex
CREATE INDEX "SystemEvent_restaurantId_idx" ON "SystemEvent"("restaurantId");

-- CreateIndex
CREATE INDEX "TableAssignment_restaurantId_idx" ON "TableAssignment"("restaurantId");

-- CreateIndex
CREATE INDEX "TableDraft_restaurantId_idx" ON "TableDraft"("restaurantId");

-- CreateIndex
CREATE INDEX "TicketItem_restaurantId_idx" ON "TicketItem"("restaurantId");

-- AddForeignKey
ALTER TABLE "NfcTag" ADD CONSTRAINT "NfcTag_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableAssignment" ADD CONSTRAINT "TableAssignment_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCart" ADD CONSTRAINT "SessionCart_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableDraft" ADD CONSTRAINT "TableDraft_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftItem" ADD CONSTRAINT "DraftItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicket" ADD CONSTRAINT "KitchenTicket_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketItem" ADD CONSTRAINT "TicketItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffUser" ADD CONSTRAINT "StaffUser_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemEvent" ADD CONSTRAINT "SystemEvent_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
