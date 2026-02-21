-- Allow standalone (unassigned) tag sessions to submit orders/tickets.
ALTER TABLE "Order"
ALTER COLUMN "tableId" DROP NOT NULL;

ALTER TABLE "KitchenTicket"
ALTER COLUMN "tableId" DROP NOT NULL;
