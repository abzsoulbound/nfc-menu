CREATE TABLE IF NOT EXISTS "Restaurant" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "monogram" TEXT NOT NULL DEFAULT 'RM',
  "location" TEXT,
  "logoUrl" TEXT,
  "heroUrl" TEXT,
  "staffAuth" JSONB NOT NULL,
  "isDemo" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Restaurant_slug_key"
  ON "Restaurant"("slug");

CREATE TABLE IF NOT EXISTS "RestaurantSetupToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "restaurantId" TEXT,
  CONSTRAINT "RestaurantSetupToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantSetupToken_tokenHash_key"
  ON "RestaurantSetupToken"("tokenHash");

CREATE INDEX IF NOT EXISTS "RestaurantSetupToken_restaurantId_idx"
  ON "RestaurantSetupToken"("restaurantId");

DO $$ BEGIN
  ALTER TABLE "RestaurantSetupToken"
    ADD CONSTRAINT "RestaurantSetupToken_restaurantId_fkey"
    FOREIGN KEY ("restaurantId")
    REFERENCES "Restaurant"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

INSERT INTO "Restaurant" (
  "id",
  "slug",
  "name",
  "monogram",
  "location",
  "logoUrl",
  "heroUrl",
  "staffAuth",
  "isDemo",
  "active"
)
VALUES (
  'seed-fable-stores',
  'fable-stores',
  'Fable Stores',
  'FS',
  'Loughton, Essex',
  '/brand/fable-stores-logo.png',
  NULL,
  '{"WAITER":["1111"],"BAR":["3333"],"KITCHEN":["2222"],"MANAGER":["4444"],"ADMIN":["9999"]}'::jsonb,
  true,
  true
)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Restaurant" (
  "id",
  "slug",
  "name",
  "monogram",
  "location",
  "logoUrl",
  "heroUrl",
  "staffAuth",
  "isDemo",
  "active"
)
VALUES (
  'seed-demo',
  'demo',
  'Restaurant Demo',
  'RD',
  NULL,
  NULL,
  NULL,
  '{"WAITER":["1111"],"BAR":["3333"],"KITCHEN":["2222"],"MANAGER":["4444"],"ADMIN":["9999"]}'::jsonb,
  true,
  true
)
ON CONFLICT ("slug") DO NOTHING;
