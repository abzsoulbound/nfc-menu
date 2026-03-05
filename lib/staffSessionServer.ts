import { createHmac, randomBytes, timingSafeEqual } from "crypto"
import {
  getDefaultRestaurantSlug,
  normalizeRestaurantSlug,
} from "@/lib/tenant"

type StaffRole =
  | "WAITER"
  | "BAR"
  | "KITCHEN"
  | "MANAGER"
  | "ADMIN"

type StaffSessionPayload = {
  v: 1
  r: StaffRole
  t: string
  i: number
  e: number
  n: string
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 12

function isSecretConfigured(secret: string | undefined) {
  if (!secret) return false
  const trimmed = secret.trim()
  return trimmed !== "" && trimmed !== "changeme"
}

function toBase64Url(input: Buffer) {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4)
  return Buffer.from(normalized + padding, "base64")
}

function getSessionSecret() {
  const staffSecret = process.env.STAFF_SESSION_SECRET
  if (staffSecret && isSecretConfigured(staffSecret)) {
    return staffSecret.trim()
  }

  const systemSecret = process.env.SYSTEM_AUTH_SECRET
  if (systemSecret && isSecretConfigured(systemSecret)) {
    return systemSecret.trim()
  }

  if (process.env.NODE_ENV !== "production") {
    return "dev-staff-session-secret"
  }
  return null
}

function signPayload(payloadB64: string, secret: string) {
  return createHmac("sha256", secret).update(payloadB64).digest()
}

function isKnownRole(value: string): value is StaffRole {
  return (
    value === "WAITER" ||
    value === "BAR" ||
    value === "KITCHEN" ||
    value === "MANAGER" ||
    value === "ADMIN"
  )
}

export function issueStaffSessionToken(
  role: StaffRole,
  restaurantSlug: string,
  ttlSeconds = DEFAULT_TTL_SECONDS
) {
  const secret = getSessionSecret()
  if (!secret) return null
  const tenantSlug =
    normalizeRestaurantSlug(restaurantSlug) ??
    getDefaultRestaurantSlug()

  const now = Math.floor(Date.now() / 1000)
  const payload: StaffSessionPayload = {
    v: 1,
    r: role,
    t: tenantSlug,
    i: now,
    e: now + Math.max(60, Math.floor(ttlSeconds)),
    n: toBase64Url(randomBytes(12)),
  }

  const payloadB64 = toBase64Url(
    Buffer.from(JSON.stringify(payload), "utf8")
  )
  const signature = signPayload(payloadB64, secret)
  return `${payloadB64}.${toBase64Url(signature)}`
}

export function verifyStaffSessionToken(token: string | null) {
  if (!token || token.trim() === "") return null
  const secret = getSessionSecret()
  if (!secret) return null

  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [payloadB64, signatureB64] = parts
  if (!payloadB64 || !signatureB64) return null

  const expected = signPayload(payloadB64, secret)
  const provided = fromBase64Url(signatureB64)
  if (expected.length !== provided.length) return null
  if (!timingSafeEqual(expected, provided)) return null

  let payload: StaffSessionPayload
  try {
    payload = JSON.parse(
      fromBase64Url(payloadB64).toString("utf8")
    ) as StaffSessionPayload
  } catch {
    return null
  }

  if (payload.v !== 1) return null
  if (!isKnownRole(payload.r)) return null
  const tenantSlug = normalizeRestaurantSlug(payload.t)
  if (!tenantSlug) return null
  const now = Math.floor(Date.now() / 1000)
  if (!Number.isFinite(payload.e) || payload.e <= now) return null

  return {
    role: payload.r,
    tenantSlug,
    expiresAt: payload.e,
    issuedAt: payload.i,
  }
}
