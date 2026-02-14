import { NextResponse, type NextRequest } from "next/server"
import {
  DEFAULT_RESTAURANT_ID,
  DEFAULT_RESTAURANT_NAME,
  DEFAULT_RESTAURANT_SLUG,
  RESTAURANT_COOKIE,
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
const RESOLVER_CACHE_TTL_MS = 30_000

const resolverCache = new Map<
  string,
  {
    expiresAt: number
    context: MiddlewareRestaurantContext
  }
>()

function normalizedSlug(value: string | undefined) {
  if (!value) return ""
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

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

function slugFromPath(pathname: string) {
  const prefixedMatch = pathname.match(/^\/r\/([^/]+)/i)
  if (prefixedMatch?.[1]) return normalizedSlug(prefixedMatch[1])

  const orderMatch = pathname.match(/^\/order\/r\/([^/]+)/i)
  if (orderMatch?.[1]) return normalizedSlug(orderMatch[1])

  return ""
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
  slugFromRoute: string,
  requestId: string
) {
  const cacheKey = `${hostname}::${slugFromRoute}`
  const cached = resolverCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.context
  }

  const resolverUrl = new URL(
    "/api/internal/restaurant-context",
    req.nextUrl.origin
  )
  if (hostname) {
    resolverUrl.searchParams.set("hostname", hostname)
  }
  if (slugFromRoute) {
    resolverUrl.searchParams.set("slug", slugFromRoute)
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
      return fallbackContext()
    }

    const payload = (await res.json()) as {
      restaurant?: unknown
    }

    const parsed = parseRestaurantContext(payload.restaurant)
    if (!parsed) {
      return fallbackContext()
    }

    resolverCache.set(cacheKey, {
      expiresAt: Date.now() + RESOLVER_CACHE_TTL_MS,
      context: parsed,
    })

    return parsed
  } catch {
    return fallbackContext()
  }
}

function encodeContextHeader(context: MiddlewareRestaurantContext) {
  return encodeURIComponent(JSON.stringify(context))
}

function staffLoginPath(pathname: string, restaurantSlug: string) {
  const tenantMatch = pathname.match(/^\/r\/([^/]+)/i)
  if (tenantMatch?.[1]) {
    return `/r/${encodeURIComponent(tenantMatch[1])}/staff/login`
  }

  if (restaurantSlug && restaurantSlug !== DEFAULT_RESTAURANT_SLUG) {
    return `/r/${encodeURIComponent(restaurantSlug)}/staff/login`
  }

  return "/staff/login"
}

function isAuthDemoBypassEnabled() {
  const raw =
    process.env.AUTH_DEMO_BYPASS ??
    process.env.NEXT_PUBLIC_AUTH_DEMO_BYPASS ??
    ""
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
    pathname.startsWith("/bar/") ||
    /^\/r\/[^/]+\/bar(\/.*)?$/.test(pathname)
  ) {
    return "bar"
  }

  if (
    pathname === "/kitchen" ||
    pathname.startsWith("/kitchen/") ||
    /^\/r\/[^/]+\/kitchen(\/.*)?$/.test(pathname)
  ) {
    return "kitchen"
  }

  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    /^\/r\/[^/]+\/admin(\/.*)?$/.test(pathname) ||
    /^\/r\/[^/]+\/dashboard(\/.*)?$/.test(pathname)
  ) {
    return "admin"
  }

  if (
    pathname === "/staff" ||
    pathname.startsWith("/staff/") ||
    /^\/r\/[^/]+\/staff(\/.*)?$/.test(pathname)
  ) {
    return "waiter"
  }

  const nonAdmin = roles.find(role => role !== "admin")
  return nonAdmin ?? roles[0] ?? "admin"
}

function requiredStaffRoles(pathname: string) {
  if (
    pathname === "/staff/login" ||
    /^\/r\/[^/]+\/staff\/login$/.test(pathname)
  ) {
    return null
  }

  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    /^\/r\/[^/]+\/admin(\/.*)?$/.test(pathname) ||
    /^\/r\/[^/]+\/dashboard(\/.*)?$/.test(pathname)
  ) {
    return ["admin"] as const
  }

  if (
    pathname === "/bar" ||
    pathname.startsWith("/bar/") ||
    /^\/r\/[^/]+\/bar(\/.*)?$/.test(pathname)
  ) {
    return ["admin", "bar"] as const
  }

  if (
    pathname === "/kitchen" ||
    pathname.startsWith("/kitchen/") ||
    /^\/r\/[^/]+\/kitchen(\/.*)?$/.test(pathname)
  ) {
    return ["admin", "kitchen"] as const
  }

  if (
    pathname === "/staff" ||
    pathname.startsWith("/staff/") ||
    /^\/r\/[^/]+\/staff(\/.*)?$/.test(pathname)
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
  const slugFromRoute = slugFromPath(pathname)
  const requestId =
    req.headers.get(REQUEST_ID_HEADER) || crypto.randomUUID()
  const hostname = normalizedDomain(
    req.headers.get("x-forwarded-host") ??
      req.headers.get("host") ??
      req.nextUrl.hostname
  )
  const context = await resolveContextInMiddleware(
    req,
    hostname,
    slugFromRoute,
    requestId
  )
  const slug = context.slug

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)
  requestHeaders.set("x-restaurant-id", context.id)
  requestHeaders.set("x-restaurant-slug", slug)
  if (context.domain) {
    requestHeaders.set("x-restaurant-domain", context.domain)
  } else {
    requestHeaders.delete("x-restaurant-domain")
  }
  requestHeaders.set(RESTAURANT_CONTEXT_HEADER, encodeContextHeader(context))

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
      const loginPath = staffLoginPath(pathname, slug)
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

  const existingCookieSlug = normalizedSlug(
    req.cookies.get(RESTAURANT_COOKIE)?.value
  )
  if (existingCookieSlug !== slug) {
    res.cookies.set(RESTAURANT_COOKIE, slug, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  return res
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|icons|api/internal/restaurant-context|api/internal/staff-session).*)",
  ],
}
