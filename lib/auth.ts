import { cookies, headers } from "next/headers"

export type ActorType = "customer" | "staff" | "system"
export type StaffRole =
  | "WAITER"
  | "BAR"
  | "KITCHEN"
  | "MANAGER"
  | "ADMIN"

export type StaffIdentity = {
  id: string
  authToken: string
  role: StaffRole
}

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

function readHeader(req: Request | undefined, key: string) {
  if (req) return req.headers.get(key)
  return headers().get(key)
}

function readCookieFromHeader(raw: string | null, key: string) {
  if (!raw) return null
  const parts = raw.split(";")
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=")
    if (k === key) {
      return decodeURIComponent(rest.join("="))
    }
  }
  return null
}

function readStaffToken(req?: Request) {
  const headerToken = readHeader(req, "x-staff-auth")
  if (headerToken) return headerToken

  if (req) {
    return readCookieFromHeader(
      req.headers.get("cookie"),
      "staff_auth"
    )
  }

  return cookies().get("staff_auth")?.value ?? null
}

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
  const roleCodes = parseCodes(process.env[ROLE_ENV_KEYS[role]])
  if (roleCodes.length > 0) {
    return roleCodes
  }

  // Backward compatibility for previous single shared secret.
  if (role === "WAITER") {
    return parseCodes(process.env.STAFF_AUTH_SECRET)
  }

  return []
}

function isProduction() {
  return process.env.NODE_ENV === "production"
}

function isStaffAuthConfigured() {
  return ROLE_PRIORITY.some(role => getCodesForRole(role).length > 0)
}

export function resolveStaffRole(authToken: string | null) {
  if (!authToken) return null
  const token = authToken.trim()

  for (const role of ROLE_PRIORITY) {
    if (getCodesForRole(role).includes(token)) {
      return role
    }
  }

  return null
}

export function canRoleAccess(
  role: StaffRole,
  allowedRoles: StaffRole[]
) {
  const access = ROLE_ACCESS[role]
  return allowedRoles.some(allowed => access.includes(allowed))
}

export function getDefaultRouteForRole(role: StaffRole) {
  if (role === "ADMIN") return "/admin"
  if (role === "MANAGER") return "/manager"
  if (role === "KITCHEN") return "/kitchen"
  if (role === "BAR") return "/bar"
  return "/waiter"
}

export function isStaffTokenValid(authToken: string | null) {
  if (!isStaffAuthConfigured()) {
    return !isProduction()
  }
  return resolveStaffRole(authToken) !== null
}

export function isSystemTokenValid(authToken: string | null) {
  const secret = process.env.SYSTEM_AUTH_SECRET
  if (!isSecretConfigured(secret)) {
    return !isProduction()
  }
  return authToken === secret
}

export function getActorType(req?: Request): ActorType {
  const staffToken = readStaffToken(req)
  if (isStaffTokenValid(staffToken) && staffToken) {
    return "staff"
  }
  if (isSystemTokenValid(readHeader(req, "x-system-auth"))) {
    if (readHeader(req, "x-system-auth")) return "system"
  }
  return "customer"
}

export function requireStaff(req?: Request): StaffIdentity {
  const authToken = readStaffToken(req)
  const role = resolveStaffRole(authToken)

  if (!isStaffAuthConfigured()) {
    if (isProduction()) {
      throw new Error("Unauthorized: staff auth is not configured")
    }

    return {
      id: readHeader(req, "x-staff-id") ?? "staff-dev",
      authToken: authToken ?? "dev-token",
      role: "ADMIN",
    }
  }

  if (!authToken || !role) {
    throw new Error("Unauthorized: staff only")
  }
  return {
    id: readHeader(req, "x-staff-id") ?? "staff-unknown",
    authToken,
    role,
  }
}

export function requireSystem(req?: Request) {
  const authToken = readHeader(req, "x-system-auth")
  const secret = process.env.SYSTEM_AUTH_SECRET

  if (!isSecretConfigured(secret)) {
    if (isProduction()) {
      throw new Error("Unauthorized: system auth is not configured")
    }

    return { authToken: authToken ?? "dev-token" }
  }

  if (!authToken || !isSystemTokenValid(authToken)) {
    throw new Error("Unauthorized: system only")
  }
  return { authToken }
}

export function requireRole(
  allowedRoles: StaffRole[],
  req?: Request
) {
  const staff = requireStaff(req)
  if (!canRoleAccess(staff.role, allowedRoles)) {
    throw new Error("Unauthorized: insufficient role")
  }
  return staff
}

export function getStaffIdentity(staff: StaffIdentity) {
  return {
    id: staff.id,
    role: staff.role,
  }
}

export function getActorMetadata(req?: Request) {
  return {
    actor: getActorType(req),
    staffId: readHeader(req, "x-staff-id"),
    timestamp: new Date().toISOString(),
  }
}
