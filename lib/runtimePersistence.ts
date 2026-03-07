import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import {
  exportRuntimeStateSnapshot,
  importRuntimeStateSnapshot,
} from "@/lib/runtimeStore"
import { getRestaurantContextSlug } from "@/lib/tenantContext"
import { getDefaultRestaurantSlug } from "@/lib/tenant"
import { isDurableRuntimeRequired } from "@/lib/env"

const LEGACY_HISTORY_ID = "runtime:state:v1"
const RETRY_BACKOFF_MS = 30_000

class RuntimePersistenceConflictError extends Error {}

const globalForRuntimePersistence = globalThis as unknown as {
  __NFC_RUNTIME_HYDRATED_AT_BY_TENANT__?: Partial<
    Record<string, number>
  >
  __NFC_RUNTIME_PERSISTED_UPDATED_AT_BY_TENANT__?: Partial<
    Record<string, string>
  >
  __NFC_RUNTIME_HYDRATING_BY_TENANT__?: Partial<
    Record<string, Promise<void>>
  >
  __NFC_RUNTIME_DISABLED_UNTIL_BY_TENANT__?: Partial<
    Record<string, number>
  >
}

function hydratedAtByTenant() {
  if (!globalForRuntimePersistence.__NFC_RUNTIME_HYDRATED_AT_BY_TENANT__) {
    globalForRuntimePersistence.__NFC_RUNTIME_HYDRATED_AT_BY_TENANT__ = {}
  }
  return globalForRuntimePersistence.__NFC_RUNTIME_HYDRATED_AT_BY_TENANT__
}

function persistedUpdatedAtByTenant() {
  if (
    !globalForRuntimePersistence.__NFC_RUNTIME_PERSISTED_UPDATED_AT_BY_TENANT__
  ) {
    globalForRuntimePersistence.__NFC_RUNTIME_PERSISTED_UPDATED_AT_BY_TENANT__ =
      {}
  }
  return globalForRuntimePersistence.__NFC_RUNTIME_PERSISTED_UPDATED_AT_BY_TENANT__
}

function hydratingByTenant() {
  if (!globalForRuntimePersistence.__NFC_RUNTIME_HYDRATING_BY_TENANT__) {
    globalForRuntimePersistence.__NFC_RUNTIME_HYDRATING_BY_TENANT__ = {}
  }
  return globalForRuntimePersistence.__NFC_RUNTIME_HYDRATING_BY_TENANT__
}

function disabledUntilByTenant() {
  if (
    !globalForRuntimePersistence.__NFC_RUNTIME_DISABLED_UNTIL_BY_TENANT__
  ) {
    globalForRuntimePersistence.__NFC_RUNTIME_DISABLED_UNTIL_BY_TENANT__ = {}
  }
  return globalForRuntimePersistence.__NFC_RUNTIME_DISABLED_UNTIL_BY_TENANT__
}

function runtimeHistoryId(restaurantSlug: string) {
  return `runtime:state:v1:${restaurantSlug}`
}

function readKnownUpdatedAt(restaurantSlug: string) {
  return persistedUpdatedAtByTenant()[restaurantSlug] ?? null
}

function writeKnownUpdatedAt(
  restaurantSlug: string,
  value: Date | string | null
) {
  const map = persistedUpdatedAtByTenant()
  if (!value) {
    delete map[restaurantSlug]
    return
  }
  map[restaurantSlug] =
    value instanceof Date ? value.toISOString() : value
}

function canAttemptPersistence(restaurantSlug: string) {
  if (!process.env.DATABASE_URL) return false
  const disabledUntil = disabledUntilByTenant()[restaurantSlug] ?? 0
  return Date.now() >= disabledUntil
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
}

async function readScopedRuntimeRecord(restaurantSlug: string) {
  return prisma.history.findUnique({
    where: { id: runtimeHistoryId(restaurantSlug) },
    select: {
      id: true,
      data: true,
      updatedAt: true,
    },
  })
}

async function createScopedRuntimeRecord(input: {
  restaurantSlug: string
  snapshot: Prisma.InputJsonValue
}) {
  return prisma.history.create({
    data: {
      id: runtimeHistoryId(input.restaurantSlug),
      data: input.snapshot,
    },
    select: {
      updatedAt: true,
    },
  })
}

async function hydrateLatestRuntimeRecord(restaurantSlug: string) {
  const latest = await readScopedRuntimeRecord(restaurantSlug)
  if (!latest?.data) {
    writeKnownUpdatedAt(restaurantSlug, latest?.updatedAt ?? null)
    return
  }
  importRuntimeStateSnapshot(latest.data, restaurantSlug)
  writeKnownUpdatedAt(restaurantSlug, latest.updatedAt)
}

export type RuntimePersistenceHealth = {
  tenantSlug: string
  durableRequired: boolean
  databaseConfigured: boolean
  canAttempt: boolean
  backoffActive: boolean
  disabledUntil: string | null
}

export function getRuntimePersistenceHealth(
  restaurantSlug = getRestaurantContextSlug()
): RuntimePersistenceHealth {
  const disabledUntilMs =
    disabledUntilByTenant()[restaurantSlug] ?? 0
  const backoffActive = disabledUntilMs > Date.now()
  return {
    tenantSlug: restaurantSlug,
    durableRequired: isDurableRuntimeRequired(),
    databaseConfigured: !!process.env.DATABASE_URL,
    canAttempt: canAttemptPersistence(restaurantSlug),
    backoffActive,
    disabledUntil: backoffActive
      ? new Date(disabledUntilMs).toISOString()
      : null,
  }
}

function assertDurableRuntimePolicy(restaurantSlug: string) {
  if (!isDurableRuntimeRequired()) return
  if (canAttemptPersistence(restaurantSlug)) return
  const disabledUntil =
    disabledUntilByTenant()[restaurantSlug] ?? 0
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "Durable runtime persistence is required but DATABASE_URL is not configured"
    )
  }
  if (disabledUntil > Date.now()) {
    throw new Error(
      `Durable runtime persistence is temporarily unavailable until ${new Date(disabledUntil).toISOString()}`
    )
  }
  throw new Error(
    "Durable runtime persistence is required but unavailable"
  )
}

function markPersistenceFailure(restaurantSlug: string) {
  disabledUntilByTenant()[restaurantSlug] =
    Date.now() + RETRY_BACKOFF_MS
}

function handlePersistenceFailure(input: {
  restaurantSlug: string
  phase: "hydrate" | "persist"
  error: unknown
}) {
  markPersistenceFailure(input.restaurantSlug)
  if (!isDurableRuntimeRequired()) {
    return
  }
  const detail =
    input.error instanceof Error && input.error.message
      ? `: ${input.error.message}`
      : ""
  throw new Error(
    `Durable runtime persistence failed during ${input.phase}${detail}`
  )
}

export async function hydrateRuntimeStateFromDb(options?: {
  force?: boolean
}) {
  const restaurantSlug = getRestaurantContextSlug()
  assertDurableRuntimePolicy(restaurantSlug)
  if (!canAttemptPersistence(restaurantSlug)) return

  const force = options?.force === true
  const hydratedAt = hydratedAtByTenant()[restaurantSlug] ?? 0
  if (!force && Date.now() - hydratedAt < 2_000) {
    return
  }

  const hydrating = hydratingByTenant()
  if (hydrating[restaurantSlug]) {
    await hydrating[restaurantSlug]
    return
  }

  hydrating[restaurantSlug] = (async () => {
    try {
      const scopedRecord = await readScopedRuntimeRecord(restaurantSlug)

      if (scopedRecord?.data) {
        importRuntimeStateSnapshot(scopedRecord.data, restaurantSlug)
        writeKnownUpdatedAt(restaurantSlug, scopedRecord.updatedAt)
        hydratedAtByTenant()[restaurantSlug] = Date.now()
        return
      }

      // Backward compatibility with the previous single-tenant key.
      if (restaurantSlug === getDefaultRestaurantSlug()) {
        const legacyRecord = await prisma.history.findUnique({
          where: { id: LEGACY_HISTORY_ID },
          select: {
            data: true,
          },
        })
        if (legacyRecord?.data) {
          importRuntimeStateSnapshot(
            legacyRecord.data,
            restaurantSlug
          )
        }
      }
      writeKnownUpdatedAt(restaurantSlug, null)
      hydratedAtByTenant()[restaurantSlug] = Date.now()
    } catch (error) {
      handlePersistenceFailure({
        restaurantSlug,
        phase: "hydrate",
        error,
      })
    } finally {
      delete hydrating[restaurantSlug]
    }
  })()

  await hydrating[restaurantSlug]
}

export async function persistRuntimeStateToDb() {
  const restaurantSlug = getRestaurantContextSlug()
  assertDurableRuntimePolicy(restaurantSlug)
  if (!canAttemptPersistence(restaurantSlug)) return

  try {
    const snapshot =
      exportRuntimeStateSnapshot(restaurantSlug) as unknown as Prisma.InputJsonValue
    const scopedId = runtimeHistoryId(restaurantSlug)
    const knownUpdatedAt = readKnownUpdatedAt(restaurantSlug)

    if (!knownUpdatedAt) {
      try {
        const created = await createScopedRuntimeRecord({
          restaurantSlug,
          snapshot,
        })
        writeKnownUpdatedAt(restaurantSlug, created.updatedAt)
        return
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error
        }
      }
    }

    const current = await readScopedRuntimeRecord(restaurantSlug)
    if (!current) {
      const created = await createScopedRuntimeRecord({
        restaurantSlug,
        snapshot,
      })
      writeKnownUpdatedAt(restaurantSlug, created.updatedAt)
      return
    }

    const knownAfterRead = readKnownUpdatedAt(restaurantSlug)
    const currentUpdatedAt = current.updatedAt.toISOString()
    if (
      knownAfterRead &&
      knownAfterRead !== currentUpdatedAt
    ) {
      await hydrateLatestRuntimeRecord(restaurantSlug)
      throw new RuntimePersistenceConflictError(
        `Runtime persistence conflict for tenant ${restaurantSlug}`
      )
    }

    const updated = await prisma.history.updateMany({
      where: {
        id: scopedId,
        updatedAt: current.updatedAt,
      },
      data: {
        data: snapshot,
      },
    })

    if (updated.count !== 1) {
      await hydrateLatestRuntimeRecord(restaurantSlug)
      throw new RuntimePersistenceConflictError(
        `Runtime persistence conflict for tenant ${restaurantSlug}`
      )
    }

    const refreshed = await prisma.history.findUnique({
      where: { id: scopedId },
      select: {
        updatedAt: true,
      },
    })
    writeKnownUpdatedAt(
      restaurantSlug,
      refreshed?.updatedAt ?? null
    )
  } catch (error) {
    if (error instanceof RuntimePersistenceConflictError) {
      if (isDurableRuntimeRequired()) {
        throw error
      }
      return
    }
    handlePersistenceFailure({
      restaurantSlug,
      phase: "persist",
      error,
    })
  }
}

export function resetRuntimePersistenceCachesForTests() {
  globalForRuntimePersistence.__NFC_RUNTIME_HYDRATED_AT_BY_TENANT__ = {}
  globalForRuntimePersistence.__NFC_RUNTIME_PERSISTED_UPDATED_AT_BY_TENANT__ =
    {}
  globalForRuntimePersistence.__NFC_RUNTIME_HYDRATING_BY_TENANT__ = {}
  globalForRuntimePersistence.__NFC_RUNTIME_DISABLED_UNTIL_BY_TENANT__ = {}
}
