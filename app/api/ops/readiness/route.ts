import { ok } from "@/lib/http"
import { prisma } from "@/lib/prisma"
import { checkCoreTenantConsistency } from "@/lib/restaurants"
import {
  getPaymentMode,
  getRuntimeFeatureFlags,
  validateRequiredEnv,
} from "@/lib/env"

export const dynamic = "force-dynamic"

function publicError(
  kind: "env" | "database" | "tenants",
  message: string | null
) {
  if (!message) return null
  if (process.env.NODE_ENV !== "production") {
    return message
  }
  if (kind === "env") {
    return "Invalid production environment"
  }
  if (kind === "database") {
    return "Database check failed"
  }
  return "Tenant consistency check failed"
}

export async function GET(req: Request) {
  let envOk = true
  let envError: string | null = null

  try {
    validateRequiredEnv()
  } catch (error) {
    envOk = false
    envError = (error as Error).message
  }

  let databaseOk = false
  let databaseError: string | null = null

  if (!process.env.DATABASE_URL) {
    databaseOk = false
    databaseError = "Database is not configured"
  } else {
    try {
      await prisma.$queryRaw`SELECT 1`
      databaseOk = true
    } catch (error) {
      databaseOk = false
      databaseError = (error as Error).message
    }
  }

  let tenantsOk = false
  let tenantsError: string | null = null
  let tenantsDetails: {
    defaultSlug: string
    salesDemoSlug: string
    missing: string[]
    inactive: string[]
  } | null = null

  if (databaseOk) {
    const consistency = await checkCoreTenantConsistency()
    tenantsOk = consistency.ok
    tenantsError = consistency.error
    tenantsDetails =
      consistency.ok || process.env.NODE_ENV !== "production"
        ? {
            defaultSlug: consistency.defaultSlug,
            salesDemoSlug: consistency.salesDemoSlug,
            missing: consistency.missing,
            inactive: consistency.inactive,
          }
        : null
  } else {
    tenantsOk = false
    tenantsError = "Database is unavailable for tenant consistency checks"
  }

  const status =
    envOk && databaseOk && tenantsOk ? "ok" : "degraded"

  return ok(
    {
      status,
      timestamp: new Date().toISOString(),
      checks: {
        env: {
          ok: envOk,
          error: publicError("env", envError),
        },
        database: {
          ok: databaseOk,
          error: publicError("database", databaseError),
        },
        tenants: {
          ok: tenantsOk,
          error: publicError("tenants", tenantsError),
          details: tenantsDetails,
        },
      },
      runtime: {
        nodeEnv: process.env.NODE_ENV ?? "unknown",
        paymentMode: getPaymentMode(),
        features: getRuntimeFeatureFlags(),
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
      status: status === "ok" ? 200 : 503,
    },
    req
  )
}
