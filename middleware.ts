import { NextResponse, type NextRequest } from "next/server"
import {
  DEFAULT_RESTAURANT_ID,
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

function fallbackContext(slugFromRoute: string) {
  const slug = slugFromRoute || DEFAULT_RESTAURANT_SLUG
  return {
    id: slug === DEFAULT_RESTAURANT_SLUG ? DEFAULT_RESTAURANT_ID : slug,
    slug,
    name: "Marlo's Kitchen",
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
      return fallbackContext(slugFromRoute)
    }

    const payload = (await res.json()) as {
      restaurant?: unknown
    }

    const parsed = parseRestaurantContext(payload.restaurant)
    if (!parsed) {
      return fallbackContext(slugFromRoute)
    }

    resolverCache.set(cacheKey, {
      expiresAt: Date.now() + RESOLVER_CACHE_TTL_MS,
      context: parsed,
    })

    return parsed
  } catch {
    return fallbackContext(slugFromRoute)
  }
}

function encodeContextHeader(context: MiddlewareRestaurantContext) {
  return encodeURIComponent(JSON.stringify(context))
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
    "/((?!_next/static|_next/image|favicon.ico|images|icons|api/internal/restaurant-context).*)",
  ],
}
