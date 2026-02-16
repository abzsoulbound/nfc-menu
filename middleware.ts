import { NextResponse, type NextRequest } from "next/server"
import {
  DEFAULT_RESTAURANT_ID,
  DEFAULT_RESTAURANT_NAME,
  DEFAULT_RESTAURANT_SLUG,
} from "@/lib/restaurantConstants"

type MiddlewareRestaurantContext = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  domain: string | null
  vatRate: number
  serviceCharge: number
}

const RESTAURANT_CONTEXT_HEADER = "x-restaurant-context"
const REQUEST_ID_HEADER = "x-request-id"
const RESOLVER_CACHE_TTL_MS = 5 * 60_000

const resolverCache = new Map<
  string,
  {
    expiresAt: number
    context: MiddlewareRestaurantContext
  }
>()

function normalizedDomain(value: string | undefined | null) {
  if (!value) return ""
  const raw = value.trim().toLowerCase()
  if (!raw) return ""

  const hostCandidate = raw.includes("://")
    ? (() => {
        try {
          return new URL(raw).hostname
        } catch {
          return raw.split("://")[1] ?? raw
        }
      })()
    : raw

  return hostCandidate
    .split(",")[0]
    .split("/")[0]
    .split("?")[0]
    .split("#")[0]
    .split(":")[0]
    .trim()
    .replace(/\.+$/, "")
}

function parseRestaurantContext(value: unknown) {
  if (!value || typeof value !== "object") return null
  const parsed = value as Record<string, unknown>
  if (
    typeof parsed.id !== "string" ||
    typeof parsed.slug !== "string" ||
    typeof parsed.name !== "string"
  ) {
    return null
  }

  return {
    id: parsed.id,
    slug: parsed.slug,
    name: parsed.name,
    logoUrl: typeof parsed.logoUrl === "string" ? parsed.logoUrl : null,
    primaryColor:
      typeof parsed.primaryColor === "string"
        ? parsed.primaryColor
        : null,
    secondaryColor:
      typeof parsed.secondaryColor === "string"
        ? parsed.secondaryColor
        : null,
    domain:
      typeof parsed.domain === "string"
        ? normalizedDomain(parsed.domain) || null
        : null,
    vatRate:
      typeof parsed.vatRate === "number" && Number.isFinite(parsed.vatRate)
        ? parsed.vatRate
        : 0.2,
    serviceCharge:
      typeof parsed.serviceCharge === "number" &&
      Number.isFinite(parsed.serviceCharge)
        ? parsed.serviceCharge
        : 0,
  } satisfies MiddlewareRestaurantContext
}

function fallbackContext() {
  return {
    id: DEFAULT_RESTAURANT_ID,
    slug: DEFAULT_RESTAURANT_SLUG,
    name: DEFAULT_RESTAURANT_NAME,
    logoUrl: null,
    primaryColor: null,
    secondaryColor: null,
    domain: null,
    vatRate: 0.2,
    serviceCharge: 0,
  } satisfies MiddlewareRestaurantContext
}

async function resolveContextInMiddleware(
  req: NextRequest,
  hostname: string,
  requestId: string
) {
  const cacheKey = hostname
  const cached = resolverCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return {
      context: cached.context,
      resolved: true,
    }
  }

  const resolverUrl = new URL(
    "/api/internal/restaurant-context",
    req.nextUrl.origin
  )
  if (hostname) {
    resolverUrl.searchParams.set("hostname", hostname)
  }

  try {
    const res = await fetch(resolverUrl, {
      headers: {
        "x-internal-restaurant-resolver": "1",
        [REQUEST_ID_HEADER]: requestId,
      },
      cache: "no-store",
    })

    if (!res.ok) {
      return {
        context: fallbackContext(),
        resolved: false,
      }
    }

    const payload = (await res.json()) as {
      restaurant?: unknown
    }

    const parsed = parseRestaurantContext(payload.restaurant)
    if (!parsed) {
      return {
        context: fallbackContext(),
        resolved: false,
      }
    }

    resolverCache.set(cacheKey, {
      expiresAt: Date.now() + RESOLVER_CACHE_TTL_MS,
      context: parsed,
    })

    return {
      context: parsed,
      resolved: true,
    }
  } catch {
    return {
      context: fallbackContext(),
      resolved: false,
    }
  }
}

function encodeContextHeader(context: MiddlewareRestaurantContext) {
  return encodeURIComponent(JSON.stringify(context))
}

function staffLoginPath() {
  return "/staff/login"
}

function isAuthDemoBypassEnabled() {
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

function demoRoleForPath(
  pathname: string,
  roles: readonly string[]
) {
  if (
    pathname === "/bar" ||
    pathname.startsWith("/bar/")
  ) {
    return "bar"
  }

  if (
    pathname === "/kitchen" ||
    pathname.startsWith("/kitchen/")
  ) {
    return "kitchen"
  }

  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  ) {
    return "admin"
  }

  if (
    pathname === "/staff" ||
    pathname.startsWith("/staff/")
  ) {
    return "waiter"
  }

  const nonAdmin = roles.find(role => role !== "admin")
  return nonAdmin ?? roles[0] ?? "admin"
}

function requiredStaffRoles(pathname: string) {
  if (
    pathname === "/staff/login"
  ) {
    return null
  }

  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  ) {
    return ["admin"] as const
  }

  if (
    pathname === "/bar" ||
    pathname.startsWith("/bar/")
  ) {
    return ["admin", "bar"] as const
  }

  if (
    pathname === "/kitchen" ||
    pathname.startsWith("/kitchen/")
  ) {
    return ["admin", "kitchen"] as const
  }

  if (
    pathname === "/staff" ||
    pathname.startsWith("/staff/")
  ) {
    return ["admin", "waiter"] as const
  }

  return null
}

async function resolveStaffAccess(input: {
  req: NextRequest
  requestId: string
  restaurantId: string
  roles: readonly string[]
}) {
  const resolverUrl = new URL(
    "/api/internal/staff-session",
    input.req.nextUrl.origin
  )
  resolverUrl.searchParams.set("roles", input.roles.join(","))

  try {
    const res = await fetch(resolverUrl, {
      headers: {
        "x-internal-staff-check": "1",
        [REQUEST_ID_HEADER]: input.requestId,
        "x-restaurant-id": input.restaurantId,
        cookie: input.req.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    })

    if (!res.ok) return null
    const payload = (await res.json()) as {
      authorized?: unknown
      staffUserId?: unknown
      role?: unknown
    }
    if (payload.authorized !== true) return null
    if (typeof payload.staffUserId !== "string") return null

    return {
      staffUserId: payload.staffUserId,
      role: typeof payload.role === "string" ? payload.role : "",
    }
  } catch {
    return null
  }
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname
  const requestId =
    req.headers.get(REQUEST_ID_HEADER) || crypto.randomUUID()
  const hostname = normalizedDomain(
    req.headers.get("x-forwarded-host") ??
      req.headers.get("host") ??
      req.nextUrl.hostname
  )
  const isHighTrafficCustomerApi =
    pathname.startsWith("/api/cart/") ||
    pathname === "/api/session" ||
    pathname === "/api/sessions"

  const contextResult = isHighTrafficCustomerApi
    ? {
        context: fallbackContext(),
        resolved: false,
      }
    : await resolveContextInMiddleware(
        req,
        hostname,
        requestId
      )
  const context = contextResult.context

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)
  if (!isHighTrafficCustomerApi) {
    requestHeaders.set("x-restaurant-id", context.id)
    if (context.domain) {
      requestHeaders.set("x-restaurant-domain", context.domain)
    } else {
      requestHeaders.delete("x-restaurant-domain")
    }
    requestHeaders.set(RESTAURANT_CONTEXT_HEADER, encodeContextHeader(context))
  } else {
    requestHeaders.delete("x-restaurant-id")
    requestHeaders.delete("x-restaurant-domain")
    requestHeaders.delete(RESTAURANT_CONTEXT_HEADER)
  }

  const roles = requiredStaffRoles(pathname)
  if (roles) {
    if (isAuthDemoBypassEnabled()) {
      requestHeaders.set("x-staff-user-id", "demo-staff-user")
      requestHeaders.set(
        "x-staff-role",
        demoRoleForPath(pathname, roles)
      )
    } else {
    const staffAccess = await resolveStaffAccess({
      req,
      requestId,
      restaurantId: context.id,
      roles,
    })

    if (!staffAccess) {
      const loginPath = staffLoginPath()
      const loginUrl = new URL(loginPath, req.url)
      loginUrl.searchParams.set("next", pathname)
      const redirectRes = NextResponse.redirect(loginUrl, { status: 307 })
      redirectRes.headers.set(REQUEST_ID_HEADER, requestId)
      return redirectRes
    }

    requestHeaders.set("x-staff-user-id", staffAccess.staffUserId)
    requestHeaders.set("x-staff-role", staffAccess.role)
    }
  } else {
    requestHeaders.delete("x-staff-user-id")
    requestHeaders.delete("x-staff-role")
  }

  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  res.headers.set(REQUEST_ID_HEADER, requestId)

  return res
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|icons|api/internal/restaurant-context|api/internal/staff-session).*)",
  ],
}
