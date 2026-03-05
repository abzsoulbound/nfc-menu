// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest"
import { GET } from "@/app/api/ops/readiness/route"
import { resetEnvValidationCacheForTests } from "@/lib/env"

const mutableEnv = process.env as Record<string, string | undefined>

const previousNodeEnv = mutableEnv.NODE_ENV
const previousDatabaseUrl = mutableEnv.DATABASE_URL
const previousSystemAuthSecret = mutableEnv.SYSTEM_AUTH_SECRET
const previousStaffAuthSecret = mutableEnv.STAFF_AUTH_SECRET
const previousStaffSessionSecret = mutableEnv.STAFF_SESSION_SECRET

afterEach(() => {
  mutableEnv.NODE_ENV = previousNodeEnv
  mutableEnv.DATABASE_URL = previousDatabaseUrl
  mutableEnv.SYSTEM_AUTH_SECRET = previousSystemAuthSecret
  mutableEnv.STAFF_AUTH_SECRET = previousStaffAuthSecret
  mutableEnv.STAFF_SESSION_SECRET = previousStaffSessionSecret
  resetEnvValidationCacheForTests()
})

describe("readiness route", () => {
  it("returns structured readiness payload", async () => {
    const req = new Request("http://localhost:3000/api/ops/readiness")
    const res = await GET(req)
    expect([200, 503]).toContain(res.status)

    const payload = (await res.json()) as {
      status: "ok" | "degraded"
      checks: {
        env: { ok: boolean }
        database: { ok: boolean }
        tenants: { ok: boolean }
      }
      runtime: {
        paymentMode: "SIMULATED" | "EXTERNAL"
        features: {
          setupV2: boolean
        }
      }
    }

    expect(["ok", "degraded"]).toContain(payload.status)
    expect(typeof payload.checks.env.ok).toBe("boolean")
    expect(typeof payload.checks.database.ok).toBe("boolean")
    expect(typeof payload.checks.tenants.ok).toBe("boolean")
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(["SIMULATED", "EXTERNAL"]).toContain(
      payload.runtime.paymentMode
    )
    expect(typeof payload.runtime.features.setupV2).toBe("boolean")
  })

  it("redacts readiness error details in production", async () => {
    mutableEnv.NODE_ENV = "production"
    delete mutableEnv.DATABASE_URL
    mutableEnv.SYSTEM_AUTH_SECRET = "123456789012345678901234"
    mutableEnv.STAFF_AUTH_SECRET = "1234"
    mutableEnv.STAFF_SESSION_SECRET = "123456789012345678901234"

    const req = new Request("http://localhost:3000/api/ops/readiness")
    const res = await GET(req)
    const payload = (await res.json()) as {
      checks: {
        env: { ok: boolean; error: string | null }
        database: { ok: boolean; error: string | null }
        tenants: { ok: boolean; error: string | null }
      }
    }

    expect(payload.checks.env.ok).toBe(false)
    expect(payload.checks.database.ok).toBe(false)
    expect(payload.checks.tenants.ok).toBe(false)
    expect(payload.checks.env.error).toBe(
      "Invalid production environment"
    )
    expect(payload.checks.database.error).toBe(
      "Database check failed"
    )
    expect(payload.checks.tenants.error).toBe(
      "Tenant consistency check failed"
    )
  })
})
