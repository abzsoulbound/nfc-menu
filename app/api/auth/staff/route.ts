import { NextResponse } from "next/server"
import { getDefaultRouteForRole } from "@/lib/auth"
import { badRequest, getRequestId, readJson } from "@/lib/http"
import { issueStaffSessionToken } from "@/lib/staffSessionServer"
import {
  requireRestaurantForSlug,
  resolveRestaurantRoleForCredentials,
  resolveRestaurantRoleForPasscode,
} from "@/lib/restaurants"
import {
  resolveRestaurantSlugFromRequest,
  RESTAURANT_COOKIE_NAME,
} from "@/lib/tenant"
import { logApi } from "@/lib/logger"
import { isNamedStaffAccountsEnabled } from "@/lib/env"

type LoginBody = {
  username?: string
  passcode?: string
}

type AttemptRecord = {
  failedCount: number
  lastFailedAt: number
  lockedUntil: number
}

const MAX_FAILED_ATTEMPTS = 6
const LOCKOUT_MS = 5 * 60 * 1000
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
}

const globalForAuthRateLimit = globalThis as unknown as {
  __NFC_STAFF_LOGIN_ATTEMPTS__?: Map<string, AttemptRecord>
}

function getAttemptMap() {
  if (!globalForAuthRateLimit.__NFC_STAFF_LOGIN_ATTEMPTS__) {
    globalForAuthRateLimit.__NFC_STAFF_LOGIN_ATTEMPTS__ = new Map()
  }
  return globalForAuthRateLimit.__NFC_STAFF_LOGIN_ATTEMPTS__
}

function readClientIp(req: Request) {
  const trustedForwardedFor = req.headers.get(
    "x-vercel-forwarded-for"
  )
  if (trustedForwardedFor) {
    const firstIp = trustedForwardedFor.split(",")[0]?.trim()
    if (firstIp) return firstIp
  }
  const realIp = req.headers.get("x-real-ip")
  if (realIp) return realIp
  return "unknown"
}

function getAttemptKeys(req: Request, restaurantSlug: string) {
  const keys = [`tenant:${restaurantSlug}`]
  const clientIp = readClientIp(req)
  if (clientIp !== "unknown") {
    keys.push(`tenant-ip:${restaurantSlug}:${clientIp}`)
  }
  return keys
}

function getLockSecondsRemaining(record: AttemptRecord) {
  return Math.max(
    1,
    Math.ceil((record.lockedUntil - Date.now()) / 1000)
  )
}

function recordFailedAttempt(key: string) {
  const attempts = getAttemptMap()
  const now = Date.now()
  const current = attempts.get(key)

  const failedCount = (current?.failedCount ?? 0) + 1
  const lockedUntil =
    failedCount >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_MS : 0

  attempts.set(key, {
    failedCount,
    lastFailedAt: now,
    lockedUntil,
  })
}

function clearAttempts(key: string) {
  getAttemptMap().delete(key)
}

function getLockedAttempt(keys: string[]) {
  const attempts = getAttemptMap()
  const now = Date.now()
  for (const key of keys) {
    const record = attempts.get(key)
    if (record && record.lockedUntil > now) {
      return { key, record }
    }
  }
  return null
}

function shouldUseSecureCookie(req: Request) {
  if (process.env.NODE_ENV !== "production") {
    return false
  }

  const forwardedProto = req.headers.get("x-forwarded-proto")
  if (forwardedProto) {
    const primary = forwardedProto.split(",")[0]?.trim()
    return primary === "https"
  }

  try {
    return new URL(req.url).protocol === "https:"
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  const requestId = getRequestId(req)
  try {
    const requestedSlug = resolveRestaurantSlugFromRequest(req)
    const restaurant = await requireRestaurantForSlug(requestedSlug)
    const restaurantSlug = restaurant.slug
    const enforceLockout = !restaurant.isDemo
    const attemptKeys = getAttemptKeys(req, restaurantSlug)
    const lockedAttempt = enforceLockout
      ? getLockedAttempt(attemptKeys)
      : null
    if (enforceLockout && lockedAttempt) {
      logApi("WARN", "auth.staff.locked", {
        requestId,
        route: "/api/auth/staff",
        statusCode: 429,
      }, {
        attemptKey: lockedAttempt.key,
        failedCount: lockedAttempt.record.failedCount,
      })
      return badRequest(
        `Too many failed attempts. Try again in ${getLockSecondsRemaining(
          lockedAttempt.record
        )}s`,
        429,
        {
          code: "STAFF_LOGIN_LOCKED",
          headers: NO_STORE_HEADERS,
          req,
        }
      )
    }

    const body = await readJson<LoginBody>(req)
    const username = body.username?.trim().toLowerCase() ?? ""
    const passcode = body.passcode?.trim() ?? ""
    if (!passcode && !username) {
      return badRequest("Passcode is required", 400, {
        code: "STAFF_PASSCODE_REQUIRED",
        headers: NO_STORE_HEADERS,
        req,
      })
    }

    if (!passcode || !/^\d{4}$/.test(passcode)) {
      return badRequest("Passcode must be a 4-digit code", 400, {
        code: "STAFF_PASSCODE_INVALID",
        headers: NO_STORE_HEADERS,
        req,
      })
    }

    let role: Awaited<
      ReturnType<typeof resolveRestaurantRoleForPasscode>
    > = null

    if (isNamedStaffAccountsEnabled() && username) {
      role = await resolveRestaurantRoleForCredentials({
        slug: restaurantSlug,
        username,
        passcode,
      })
    }

    if (!role) {
      role = await resolveRestaurantRoleForPasscode(
        restaurantSlug,
        passcode
      )
    }

    if (!role) {
      if (enforceLockout) {
        for (const key of attemptKeys) {
          recordFailedAttempt(key)
        }
      }
      const attempts = getAttemptMap()
      const failedCounts = enforceLockout
        ? attemptKeys.map(key => attempts.get(key)?.failedCount ?? 0)
        : [0]
      const failedCount = Math.max(...failedCounts)
      logApi("WARN", "auth.staff.failed", {
        requestId,
        restaurantSlug,
        route: "/api/auth/staff",
        statusCode: 401,
      }, {
        attemptKey: attemptKeys.join(","),
        username: username || null,
        failedCount,
      })
      return badRequest("Invalid passcode", 401, {
        headers: NO_STORE_HEADERS,
      })
    }

    if (enforceLockout) {
      for (const key of attemptKeys) {
        clearAttempts(key)
      }
    }

    const staffSessionToken = issueStaffSessionToken(
      role,
      restaurantSlug
    )
    if (!staffSessionToken) {
      return badRequest(
        "Server auth is not configured for staff sessions",
        500,
        {
          code: "STAFF_SESSION_NOT_CONFIGURED",
          headers: NO_STORE_HEADERS,
          req,
        }
      )
    }
    const res = NextResponse.json({
      ok: true,
      role,
      username: username || undefined,
      redirectTo: getDefaultRouteForRole(role),
    })
    res.headers.set("Cache-Control", "no-store")
    const secure = shouldUseSecureCookie(req)
    res.cookies.set("staff_auth", staffSessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 60 * 60 * 12,
    })
    res.cookies.set(RESTAURANT_COOKIE_NAME, restaurantSlug, {
      httpOnly: false,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    })
    logApi("INFO", "auth.staff.success", {
      requestId,
      restaurantSlug,
      actorRole: role,
      route: "/api/auth/staff",
      statusCode: 200,
    }, {
      username: username || null,
    })
    return res
  } catch (error) {
    const message = (error as Error).message
    logApi("ERROR", "auth.staff.error", {
      requestId,
      route: "/api/auth/staff",
      statusCode: 400,
    }, {
      error: message,
    })
    return badRequest(
      message,
      message === "Restaurant was not found" ? 404 : 400,
      {
        code:
          message === "Restaurant was not found"
            ? "RESTAURANT_NOT_FOUND"
            : "STAFF_LOGIN_FAILED",
        headers: NO_STORE_HEADERS,
        req,
      }
    )
  }
}

export async function DELETE(req: Request) {
  const res = NextResponse.json({ ok: true })
  res.headers.set("Cache-Control", "no-store")
  const secure = shouldUseSecureCookie(req)
  res.cookies.set("staff_auth", "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  })
  res.cookies.set(RESTAURANT_COOKIE_NAME, "", {
    httpOnly: false,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  })
  return res
}
