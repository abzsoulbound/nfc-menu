import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  normalizeRestaurantSlug,
  resolveRestaurantSlugFromRequest,
} from "@/lib/tenant"

type StaffRole =
  | "WAITER"
  | "BAR"
  | "KITCHEN"
  | "MANAGER"
  | "ADMIN"

const ROLE_ENV_KEYS: Record<StaffRole, string> = {
  WAITER: "WAITER_PASSCODES",
  BAR: "BAR_PASSCODES",
  KITCHEN: "KITCHEN_PASSCODES",
  MANAGER: "MANAGER_PASSCODES",
  ADMIN: "ADMIN_PASSCODES",
}

const ROLE_ACCESS: Record<StaffRole, StaffRole[]> = {
  WAITER: ["WAITER"],
  BAR: ["BAR"],
  KITCHEN: ["KITCHEN"],
  MANAGER: ["WAITER", "BAR", "KITCHEN", "MANAGER"],
  ADMIN: ["WAITER", "BAR", "KITCHEN", "MANAGER", "ADMIN"],
}

const ROLE_PRIORITY: StaffRole[] = [
  "ADMIN",
  "MANAGER",
  "KITCHEN",
  "BAR",
  "WAITER",
]

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function isSecretConfigured(secret: string | undefined) {
  if (!secret) return false
  return secret.trim() !== "" && secret !== "changeme"
}

function parseCodes(raw: string | undefined) {
  if (!isSecretConfigured(raw)) return []
  return (raw ?? "")
    .split(",")
    .map(code => code.trim())
    .filter(Boolean)
}

function getCodesForRole(role: StaffRole) {
  const codes = parseCodes(process.env[ROLE_ENV_KEYS[role]])
  if (codes.length > 0) {
    return codes
  }

  if (role === "WAITER") {
    return parseCodes(process.env.STAFF_AUTH_SECRET)
  }

  return []
}

function isStaffAuthConfigured() {
  return ROLE_PRIORITY.some(role => getCodesForRole(role).length > 0)
}

function resolveRole(authToken: string | null) {
  if (!authToken) return null
  const token = authToken.trim()

  for (const role of ROLE_PRIORITY) {
    if (getCodesForRole(role).includes(token)) {
      return role
    }
  }

  return null
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

  if (!isProduction()) {
    return "dev-staff-session-secret"
  }
  return null
}

function base64UrlToBytes(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
  const padded =
    normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
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

async function resolveRoleFromSessionToken(
  token: string,
  expectedRestaurantSlug: string
) {
  const secret = getSessionSecret()
  if (!secret) return null

  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [payloadB64, signatureB64] = parts
  if (!payloadB64 || !signatureB64) return null

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      textEncoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    )

    const verified = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signatureB64),
      textEncoder.encode(payloadB64)
    )
    if (!verified) return null

    const payloadJson = textDecoder.decode(base64UrlToBytes(payloadB64))
    const payload = JSON.parse(payloadJson) as {
      v?: number
      r?: string
      t?: string
      e?: number
    }
    if (payload.v !== 1) return null
    if (!payload.r || !isKnownRole(payload.r)) return null
    const payloadTenant = normalizeRestaurantSlug(payload.t)
    if (!payloadTenant) return null
    if (payloadTenant !== expectedRestaurantSlug) return null
    if (!Number.isFinite(payload.e)) return null
    const nowSeconds = Math.floor(Date.now() / 1000)
    if ((payload.e as number) <= nowSeconds) return null

    return payload.r
  } catch {
    return null
  }
}

function canRoleAccess(
  role: StaffRole,
  allowedRoles: StaffRole[]
) {
  return allowedRoles.some(allowed =>
    ROLE_ACCESS[role].includes(allowed)
  )
}

function requiredRolesForPath(path: string): StaffRole[] | null {
  if (path.startsWith("/admin")) {
    return ["ADMIN"]
  }
  if (path.startsWith("/manager")) {
    return ["MANAGER", "ADMIN"]
  }
  if (path.startsWith("/kitchen")) {
    return ["KITCHEN", "MANAGER", "ADMIN"]
  }
  if (path.startsWith("/bar")) {
    return ["BAR", "MANAGER", "ADMIN"]
  }
  if (path.startsWith("/waiter") || path.startsWith("/staff")) {
    return ["WAITER", "MANAGER", "ADMIN"]
  }
  return null
}

function isProduction() {
  return process.env.NODE_ENV === "production"
}

function loginRedirect(req: NextRequest, path: string) {
  const loginUrl = new URL("/staff-login", req.url)
  const nextPath = `${path}${req.nextUrl.search}`
  loginUrl.searchParams.set("next", nextPath)
  return NextResponse.redirect(loginUrl)
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const restaurantSlug = resolveRestaurantSlugFromRequest(req)

  const allowedRoles = requiredRolesForPath(path)

  if (allowedRoles) {
    const staffToken =
      req.headers.get("x-staff-auth") ??
      req.cookies.get("staff_auth")?.value ??
      null

    let role: StaffRole | null = null
    if (staffToken) {
      role = await resolveRoleFromSessionToken(
        staffToken,
        restaurantSlug
      )
    }

    // Legacy passcode token support remains dev-only.
    if (!role && !isProduction()) {
      role = resolveRole(staffToken)
    }

    if (!role) {
      if (!isProduction() && !isStaffAuthConfigured()) {
        return NextResponse.next()
      }
      return loginRedirect(req, path)
    }

    if (!canRoleAccess(role, allowedRoles)) {
      return loginRedirect(req, path)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/staff/:path*",
    "/waiter/:path*",
    "/kitchen/:path*",
    "/bar/:path*",
    "/manager/:path*",
    "/admin/:path*",
  ],
}
