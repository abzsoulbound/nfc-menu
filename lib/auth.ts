import { cookies, headers } from "next/headers"
import {
  DEFAULT_RESTAURANT_SLUG,
  RESTAURANT_COOKIE,
} from "@/lib/restaurantConstants"
import { staffAuthCookies } from "@/lib/staffAuth"

export type ActorType = "customer" | "staff" | "system"
export type StaffIdentity = {
  id: string
  authToken: string
  role: string | null
  restaurantSlug: string
}

function isStaffAuthBypassed() {
  const value = process.env.AUTH_DEMO_BYPASS
  return value === "1" || value === "true"
}

function readHeader(
  req: Request | undefined,
  key: string
) {
  if (req) return req.headers.get(key)
  return headers().get(key)
}

function readCookie(
  req: Request | undefined,
  key: string
) {
  if (req) {
    const raw = req.headers.get("cookie")
    if (!raw) return null
    const parts = raw.split(";")
    for (const p of parts) {
      const [k, ...rest] = p.trim().split("=")
      if (k === key) {
        return decodeURIComponent(rest.join("="))
      }
    }
    return null
  }
  return cookies().get(key)?.value ?? null
}

function hasValidStaffToken(req?: Request) {
  if (isStaffAuthBypassed()) return true
  const secret = process.env.STAFF_AUTH_SECRET
  if (!secret) return false
  return (
    readHeader(req, "x-staff-auth") === secret ||
    readCookie(req, "staff_auth") === secret
  )
}

function hasValidSystemToken(req?: Request) {
  const secret = process.env.SYSTEM_AUTH_SECRET
  if (!secret) return false
  return readHeader(req, "x-system-auth") === secret
}

export function getActorType(req?: Request): ActorType {
  if (hasValidSystemToken(req)) return "system"
  if (hasValidStaffToken(req)) return "staff"
  return "customer"
}

export function requireStaff(req?: Request): StaffIdentity {
  const requestedRestaurantSlug =
    readHeader(req, "x-restaurant-slug") ??
    readCookie(req, RESTAURANT_COOKIE) ??
    DEFAULT_RESTAURANT_SLUG
  const authRestaurantSlug =
    readHeader(req, "x-staff-restaurant") ??
    readCookie(req, staffAuthCookies.restaurant) ??
    requestedRestaurantSlug

  if (isStaffAuthBypassed()) {
    return {
      id: readHeader(req, "x-staff-id") ?? "staff-demo",
      authToken: "demo-bypass",
      role:
        readHeader(req, "x-staff-role") ??
        readCookie(req, staffAuthCookies.role),
      restaurantSlug: authRestaurantSlug,
    }
  }

  const authToken =
    readHeader(req, "x-staff-auth") ??
    readCookie(req, "staff_auth")
  const secret = process.env.STAFF_AUTH_SECRET

  if (!authToken || !secret || authToken !== secret) {
    throw new Error("Unauthorized: staff only")
  }

  if (
    authRestaurantSlug &&
    requestedRestaurantSlug &&
    authRestaurantSlug !== requestedRestaurantSlug
  ) {
    throw new Error("Unauthorized: cross-restaurant access denied")
  }

  return {
    id: readHeader(req, "x-staff-id") ?? "staff-unknown",
    authToken,
    role:
      readHeader(req, "x-staff-role") ??
      readCookie(req, staffAuthCookies.role),
    restaurantSlug: authRestaurantSlug || DEFAULT_RESTAURANT_SLUG,
  }
}

export function requireSystem(req?: Request) {
  const authToken = readHeader(req, "x-system-auth")
  const secret = process.env.SYSTEM_AUTH_SECRET
  if (!authToken || !secret || authToken !== secret) {
    throw new Error("Unauthorized: system only")
  }
}

export function getStaffIdentity(staff: StaffIdentity) {
  return {
    id: staff.id,
  }
}

export function getActorMetadata(req?: Request) {
  return {
    actor: getActorType(req),
    staffId: readHeader(req, "x-staff-id"),
    timestamp: new Date().toISOString(),
  }
}
