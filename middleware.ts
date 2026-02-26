import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

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

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname

  const allowedRoles = requiredRolesForPath(path)

  if (allowedRoles) {
    const staffToken =
      req.headers.get("x-staff-auth") ??
      req.cookies.get("staff_auth")?.value ??
      null

    if (!isStaffAuthConfigured()) {
      if (isProduction()) {
        return loginRedirect(req, path)
      }

      return NextResponse.next()
    }

    const role = resolveRole(staffToken)
    if (!role || !canRoleAccess(role, allowedRoles)) {
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
