import { headers } from "next/headers"

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

export function getActorType(req?: Request): ActorType {
  if (readHeader(req, "x-staff-auth")) return "staff"
  if (readHeader(req, "x-system-auth")) return "system"
  return "customer"
}

export function requireStaff(req?: Request): StaffIdentity {
  const authToken = readHeader(req, "x-staff-auth")
  if (!authToken) {
    throw new Error("Unauthorized: staff only")
  }
  return {
    id: readHeader(req, "x-staff-id") ?? "staff-unknown",
    authToken,
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
