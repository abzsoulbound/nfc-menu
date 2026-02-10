import { cookies, headers } from "next/headers"

export type ActorType = "customer" | "staff" | "system"
export type StaffIdentity = {
  id: string
  authToken: string
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
  const authToken =
    readHeader(req, "x-staff-auth") ??
    readCookie(req, "staff_auth")
  const secret = process.env.STAFF_AUTH_SECRET

  if (!authToken || !secret || authToken !== secret) {
    throw new Error("Unauthorized: staff only")
  }
  return {
    id: readHeader(req, "x-staff-id") ?? "staff-unknown",
    authToken,
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
