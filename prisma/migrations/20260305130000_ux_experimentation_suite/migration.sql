-- CreateTable
CREATE TABLE "UxExperiment" (
    "id" TEXT NOT NULL,
    "restaurantSlug" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "trafficPercent" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "variants" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UxExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UxExperimentAssignment" (
    "id" TEXT NOT NULL,
    "restaurantSlug" TEXT NOT NULL,
    "experimentKey" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "variantKey" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UxExperimentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UxFunnelEvent" (
    "id" TEXT NOT NULL,
    "restaurantSlug" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "experimentKey" TEXT,
    "variantKey" TEXT,
    "eventName" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UxFunnelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UxExperiment_restaurantSlug_key_key" ON "UxExperiment"("restaurantSlug", "key");

-- CreateIndex
CREATE INDEX "UxExperiment_restaurantSlug_status_updatedAt_idx" ON "UxExperiment"("restaurantSlug", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UxExperimentAssignment_restaurantSlug_experimentKey_sessionId_key" ON "UxExperimentAssignment"("restaurantSlug", "experimentKey", "sessionId");

-- CreateIndex
CREATE INDEX "UxExperimentAssignment_restaurantSlug_experimentKey_assignedAt_idx" ON "UxExperimentAssignment"("restaurantSlug", "experimentKey", "assignedAt");

-- CreateIndex
CREATE INDEX "UxFunnelEvent_restaurantSlug_occurredAt_idx" ON "UxFunnelEvent"("restaurantSlug", "occurredAt");

-- CreateIndex
CREATE INDEX "UxFunnelEvent_restaurantSlug_experimentKey_occurredAt_idx" ON "UxFunnelEvent"("restaurantSlug", "experimentKey", "occurredAt");

-- CreateIndex
CREATE INDEX "UxFunnelEvent_restaurantSlug_sessionId_occurredAt_idx" ON "UxFunnelEvent"("restaurantSlug", "sessionId", "occurredAt");