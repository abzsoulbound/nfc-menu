import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { withRestaurantContext } from "@/lib/tenantContext"

const prismaMock = vi.hoisted(() => ({
  history: {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

import {
  getRuntimePersistenceHealth,
  hydrateRuntimeStateFromDb,
  persistRuntimeStateToDb,
  resetRuntimePersistenceCachesForTests,
} from "@/lib/runtimePersistence"

const originalEnv = { ...process.env }

describe("runtime persistence policy", () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.DATABASE_URL =
      "postgresql://user:pass@db.example.com:5432/app?sslmode=require"
    prismaMock.history.findUnique.mockReset()
    prismaMock.history.create.mockReset()
    prismaMock.history.updateMany.mockReset()
    resetRuntimePersistenceCachesForTests()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    resetRuntimePersistenceCachesForTests()
  })

  it("throws when durable mode is enabled and hydration fails", async () => {
    process.env.ENABLE_DURABLE_RUNTIME_REQUIRED = "true"
    prismaMock.history.findUnique.mockRejectedValueOnce(
      new Error("db unavailable")
    )

    await expect(
      withRestaurantContext("tenant-durable-a", () =>
        hydrateRuntimeStateFromDb({ force: true })
      )
    ).rejects.toThrow(
      "Durable runtime persistence failed during hydrate"
    )

    const health = withRestaurantContext("tenant-durable-a", () =>
      getRuntimePersistenceHealth()
    )
    expect(health.canAttempt).toBe(false)
    expect(health.backoffActive).toBe(true)
    expect(health.durableRequired).toBe(true)
  })

  it("throws when durable mode is enabled and persist fails", async () => {
    process.env.ENABLE_DURABLE_RUNTIME_REQUIRED = "true"
    prismaMock.history.create.mockRejectedValueOnce(
      new Error("write failure")
    )

    await expect(
      withRestaurantContext("tenant-durable-b", () =>
        persistRuntimeStateToDb()
      )
    ).rejects.toThrow(
      "Durable runtime persistence failed during persist"
    )
  })

  it("degrades silently when durable mode is disabled", async () => {
    process.env.ENABLE_DURABLE_RUNTIME_REQUIRED = "false"
    prismaMock.history.findUnique.mockRejectedValueOnce(
      new Error("db unavailable")
    )
    prismaMock.history.create.mockRejectedValueOnce(
      new Error("write failure")
    )

    await expect(
      withRestaurantContext("tenant-best-effort-a", () =>
        hydrateRuntimeStateFromDb({ force: true })
      )
    ).resolves.toBeUndefined()

    await expect(
      withRestaurantContext("tenant-best-effort-a", () =>
        persistRuntimeStateToDb()
      )
    ).resolves.toBeUndefined()
  })

  it("fails closed on write conflicts without tripping persistence backoff", async () => {
    process.env.ENABLE_DURABLE_RUNTIME_REQUIRED = "false"
    const previousRecord = {
      id: "runtime:state:v1:tenant-conflict",
      data: { history: {} },
      updatedAt: new Date("2026-03-05T10:00:00.000Z"),
    }
    const latestRecord = {
      id: "runtime:state:v1:tenant-conflict",
      data: { history: {} },
      updatedAt: new Date("2026-03-05T10:00:05.000Z"),
    }
    prismaMock.history.findUnique
      .mockResolvedValueOnce(previousRecord)
      .mockResolvedValueOnce(latestRecord)
      .mockResolvedValueOnce(latestRecord)

    await withRestaurantContext("tenant-conflict", () =>
      hydrateRuntimeStateFromDb({ force: true })
    )

    await expect(
      withRestaurantContext("tenant-conflict", () =>
        persistRuntimeStateToDb()
      )
    ).resolves.toBeUndefined()

    const health = withRestaurantContext("tenant-conflict", () =>
      getRuntimePersistenceHealth()
    )
    expect(health.backoffActive).toBe(false)
    expect(health.canAttempt).toBe(true)
  })
})
