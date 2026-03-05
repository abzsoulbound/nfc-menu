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

const globalForRuntimePersistence = globalThis as unknown as {
  __NFC_RUNTIME_HYDRATED_AT_BY_TENANT__?: Partial<
    Record<string, number>
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

function canAttemptPersistence(restaurantSlug: string) {
  if (!process.env.DATABASE_URL) return false
  const disabledUntil = disabledUntilByTenant()[restaurantSlug] ?? 0
  return Date.now() >= disabledUntil
}

function assertDurableRuntimePolicy(restaurantSlug: string) {
  if (!isDurableRuntimeRequired()) return
  if (canAttemptPersistence(restaurantSlug)) return
  throw new Error(
    "Durable runtime persistence is required but unavailable"
  )
}

function markPersistenceFailure(restaurantSlug: string) {
  disabledUntilByTenant()[restaurantSlug] =
    Date.now() + RETRY_BACKOFF_MS
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
      const scopedId = runtimeHistoryId(restaurantSlug)
      const scopedRecord = await prisma.history.findUnique({
        where: { id: scopedId },
      })

      if (scopedRecord?.data) {
        importRuntimeStateSnapshot(scopedRecord.data, restaurantSlug)
        hydratedAtByTenant()[restaurantSlug] = Date.now()
        return
      }

      // Backward compatibility with the previous single-tenant key.
      if (restaurantSlug === getDefaultRestaurantSlug()) {
        const legacyRecord = await prisma.history.findUnique({
          where: { id: LEGACY_HISTORY_ID },
        })
        if (legacyRecord?.data) {
          importRuntimeStateSnapshot(
            legacyRecord.data,
            restaurantSlug
          )
        }
      }
      hydratedAtByTenant()[restaurantSlug] = Date.now()
    } catch {
      markPersistenceFailure(restaurantSlug)
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
    await prisma.history.upsert({
      where: { id: runtimeHistoryId(restaurantSlug) },
      update: { data: snapshot },
      create: {
        id: runtimeHistoryId(restaurantSlug),
        data: snapshot,
      },
    })
  } catch {
    markPersistenceFailure(restaurantSlug)
  }
}
