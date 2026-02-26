import { NextResponse } from "next/server"
import {
  getDefaultRouteForRole,
  isStaffTokenValid,
  resolveStaffRole,
} from "@/lib/auth"
import { badRequest, readJson } from "@/lib/http"

type LoginBody = {
  passcode?: string
}

type AttemptRecord = {
  failedCount: number
  lastFailedAt: number
  lockedUntil: number
}

const MAX_FAILED_ATTEMPTS = 6
const LOCKOUT_MS = 5 * 60 * 1000

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
  const forwardedFor = req.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim()
    if (firstIp) return firstIp
  }
  const realIp = req.headers.get("x-real-ip")
  if (realIp) return realIp
  return "unknown"
}

function getAttemptKey(req: Request) {
  const userAgent = req.headers.get("user-agent") ?? "unknown"
  return `${readClientIp(req)}|${userAgent.slice(0, 120)}`
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
  try {
    const attemptKey = getAttemptKey(req)
    const existingAttempt = getAttemptMap().get(attemptKey)
    if (existingAttempt && existingAttempt.lockedUntil > Date.now()) {
      return badRequest(
        `Too many failed attempts. Try again in ${getLockSecondsRemaining(
          existingAttempt
        )}s`,
        429
      )
    }

    const body = await readJson<LoginBody>(req)
    const passcode = body.passcode?.trim() ?? ""
    if (!passcode) {
      return badRequest("Passcode is required")
    }

    if (!/^\d{4}$/.test(passcode)) {
      return badRequest("Passcode must be a 4-digit code")
    }

    if (!isStaffTokenValid(passcode)) {
      recordFailedAttempt(attemptKey)
      return badRequest("Invalid passcode", 401)
    }

    clearAttempts(attemptKey)

    const role = resolveStaffRole(passcode) ?? "WAITER"
    const res = NextResponse.json({
      ok: true,
      role,
      redirectTo: getDefaultRouteForRole(role),
    })
    const secure = shouldUseSecureCookie(req)
    res.cookies.set("staff_auth", passcode, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 60 * 60 * 12,
    })
    return res
  } catch (error) {
    return badRequest((error as Error).message)
  }
}

export async function DELETE(req: Request) {
  const res = NextResponse.json({ ok: true })
  const secure = shouldUseSecureCookie(req)
  res.cookies.set("staff_auth", "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  })
  return res
}
