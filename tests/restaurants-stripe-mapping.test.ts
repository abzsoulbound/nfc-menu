import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  restaurant: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

import {
  findRestaurantSlugByStripeAccountId,
  findRestaurantSlugByStripeCustomerId,
  updateRestaurantStripeConnection,
  upsertRestaurantStripeCustomer,
} from "@/lib/restaurants"

const originalEnv = { ...process.env }

describe("stripe tenant mapping safety", () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.DATABASE_URL =
      "postgresql://user:pass@db.example.com:5432/app?sslmode=require"
    prismaMock.restaurant.findMany.mockReset()
    prismaMock.restaurant.findFirst.mockReset()
    prismaMock.restaurant.update.mockReset()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it("returns null when stripe customer id maps to multiple tenants", async () => {
    prismaMock.restaurant.findMany.mockResolvedValue([
      { slug: "tenant-a" },
      { slug: "tenant-b" },
    ])

    await expect(
      findRestaurantSlugByStripeCustomerId("cus_dup")
    ).resolves.toBeNull()
  })

  it("returns null when stripe account id maps to multiple tenants", async () => {
    prismaMock.restaurant.findMany.mockResolvedValue([
      { slug: "tenant-a" },
      { slug: "tenant-b" },
    ])

    await expect(
      findRestaurantSlugByStripeAccountId("acct_dup")
    ).resolves.toBeNull()
  })

  it("rejects linking stripe customer id already used by another tenant", async () => {
    prismaMock.restaurant.findFirst.mockResolvedValue({
      slug: "tenant-b",
    })

    await expect(
      upsertRestaurantStripeCustomer({
        slug: "tenant-a",
        stripeCustomerId: "cus_shared",
      })
    ).rejects.toThrow(
      "Stripe customer is already linked to another restaurant"
    )
    expect(prismaMock.restaurant.update).not.toHaveBeenCalled()
  })

  it("rejects linking stripe account id already used by another tenant", async () => {
    prismaMock.restaurant.findFirst.mockResolvedValue({
      slug: "tenant-b",
    })

    await expect(
      updateRestaurantStripeConnection({
        slug: "tenant-a",
        stripeAccountId: "acct_shared",
        stripeAccountStatus: "CONNECTED",
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        stripeDetailsSubmitted: true,
      })
    ).rejects.toThrow(
      "Stripe account is already linked to another restaurant"
    )
    expect(prismaMock.restaurant.update).not.toHaveBeenCalled()
  })
})
