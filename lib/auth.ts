import { cookies, headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { requireRestaurantContext } from "@/lib/db/tenant"
import { STAFF_SESSION_COOKIE } from "@/lib/staffAuth"
import { hashSessionToken } from "@/lib/staffSessions"

export type ActorType = "customer" | "staff" | "system"

export type StaffIdentity = {
  id: string
  staffUserId: string
  staffSessionId: string
  role: string | null
  restaurantId: string
  restaurantSlug: string
}

function readHeader(req: Request | undefined, key: string) {
  if (req) return req.headers.get(key)
  return headers().get(key)
}

function readCookie(req: Request | undefined, key: string) {
  if (req) {
    const raw = req.headers.get("cookie")
    if (!raw) return null

    const prefix = `${key}=`
    const part = raw
      .split(";")
      .map(value => value.trim())
      .find(value => value.startsWith(prefix))

    if (!part) return null

    try {
      return decodeURIComponent(part.slice(prefix.length))
    } catch {
      return part.slice(prefix.length)
    }
  }

  return cookies().get(key)?.value ?? null
}

function hasValidSystemToken(req?: Request) {
  const secret = process.env.SYSTEM_AUTH_SECRET
  if (!secret) return false
  return readHeader(req, "x-system-auth") === secret
}

function hasAuthDemoBypassEnabled() {
  if (process.env.NODE_ENV === "production") {
    return false
  }
  const raw = process.env.AUTH_DEMO_BYPASS ?? ""
  const normalized = raw.trim().toLowerCase()
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  )
}

function hasStaffSessionCookie(req?: Request) {
  return Boolean(readCookie(req, STAFF_SESSION_COOKIE))
}

export function getActorType(req?: Request): ActorType {
  if (hasValidSystemToken(req)) return "system"
  if (hasStaffSessionCookie(req)) return "staff"
  if (
    hasAuthDemoBypassEnabled() &&
    typeof readHeader(req, "x-staff-user-id") === "string"
  ) {
    return "staff"
  }
  return "customer"
}

export async function requireStaffSession(
  req?: Request
): Promise<StaffIdentity> {
  const context = requireRestaurantContext({
    get: key => readHeader(req, key),
  })

  if (hasAuthDemoBypassEnabled()) {
    const headerRole = readHeader(req, "x-staff-role")
    const resolvedRole =
      typeof headerRole === "string" && headerRole.trim().length > 0
        ? headerRole.trim()
        : "admin"

    return {
      id: "demo-staff-user",
      staffUserId: "demo-staff-user",
      staffSessionId: "demo-staff-session",
      role: resolvedRole,
      restaurantId: context.restaurantId,
      restaurantSlug: context.restaurantSlug,
    }
  }

  const rawToken = readCookie(req, STAFF_SESSION_COOKIE)
  if (!rawToken) {
    throw new Error("Unauthorized: missing staff session")
  }

  const tokenHash = hashSessionToken(rawToken)
  const session = await prisma.staffSession.findFirst({
    where: {
      tokenHash,
      restaurantId: context.restaurantId,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
      staffUser: {
        active: true,
        restaurantId: context.restaurantId,
      },
    },
    include: {
      staffUser: {
        select: {
          id: true,
          role: true,
        },
      },
    },
  })

  if (!session) {
    throw new Error("Unauthorized: invalid staff session")
  }

  // Non-blocking touch to track activity.
  prisma.staffSession
    .update({
      where: { id: session.id },
      data: {
        lastSeenAt: new Date(),
      },
    })
    .catch(() => undefined)

  return {
    id: session.staffUser.id,
    staffUserId: session.staffUser.id,
    staffSessionId: session.id,
    role: session.staffUser.role,
    restaurantId: context.restaurantId,
    restaurantSlug: context.restaurantSlug,
  }
}

export async function requireStaffRole(
  req: Request,
  allowedRoles: string[]
): Promise<StaffIdentity> {
  const staff = await requireStaffSession(req)
  if (!staff.role || !allowedRoles.includes(staff.role)) {
    throw new Error("Unauthorized: insufficient staff role")
  }
  return staff
}

export async function requireStaff(req?: Request): Promise<StaffIdentity> {
  return requireStaffSession(req)
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
    staffSession: hasStaffSessionCookie(req),
    timestamp: new Date().toISOString(),
  }
}
