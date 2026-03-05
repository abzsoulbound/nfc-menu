const FALLBACK_RESTAURANT_SLUG = "demo-template"
const FALLBACK_SALES_DEMO_SLUG = "sales-demo"
const RESTAURANT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const RESERVED_HOST_PARTS = new Set(["www", "app", "localhost"])

export const RESTAURANT_COOKIE_NAME = "restaurant_slug"

function isIpv4Host(host: string) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
}

function isLikelyIpv6Host(host: string) {
  return host.includes(":")
}

function isPlatformHost(host: string) {
  return (
    host.endsWith(".vercel.app") ||
    host.endsWith(".vercel.sh")
  )
}

function isEnabledFlag(value: string | undefined) {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  )
}

export function normalizeRestaurantSlug(value: string | null | undefined) {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (
    normalized.length < 2 ||
    normalized.length > 48 ||
    !RESTAURANT_SLUG_PATTERN.test(normalized)
  ) {
    return null
  }
  return normalized
}

export function getDefaultRestaurantSlug() {
  return (
    normalizeRestaurantSlug(process.env.DEFAULT_RESTAURANT_SLUG) ??
    FALLBACK_RESTAURANT_SLUG
  )
}

export function getSalesDemoSlug() {
  return (
    normalizeRestaurantSlug(process.env.SALES_DEMO_SLUG) ??
    FALLBACK_SALES_DEMO_SLUG
  )
}

export function isTenantOverrideAllowedInRequestResolution() {
  if (process.env.NODE_ENV !== "production") {
    return true
  }
  return isEnabledFlag(
    process.env.ALLOW_TENANT_OVERRIDE_IN_PRODUCTION
  )
}

export function isSalesDemoSlug(slug: string | null | undefined) {
  const normalized = normalizeRestaurantSlug(slug)
  if (!normalized) return false
  return normalized === getSalesDemoSlug()
}

function sanitizeNextPath(nextPath: string, fallbackPath: string) {
  if (!nextPath.startsWith("/")) return fallbackPath
  if (nextPath.startsWith("//")) return fallbackPath
  return nextPath
}

export function restaurantEntryPathForSlug(
  slug: string | null | undefined,
  nextPath = "/menu"
) {
  const normalized =
    normalizeRestaurantSlug(slug) ?? getDefaultRestaurantSlug()
  const safeNext = sanitizeNextPath(nextPath, "/menu")
  return `/r/${encodeURIComponent(normalized)}?next=${encodeURIComponent(
    safeNext
  )}`
}

export type RestaurantScopedLinks = {
  entry: string
  menu: string
  staffLogin: string
  staff: string
  kitchen: string
  bar: string
  manager: string
  admin: string
  payTable1: string
}

export function buildRestaurantScopedLinks(
  slug: string | null | undefined
): RestaurantScopedLinks {
  return {
    entry: restaurantEntryPathForSlug(slug, "/menu"),
    menu: restaurantEntryPathForSlug(slug, "/menu"),
    staffLogin: restaurantEntryPathForSlug(slug, "/staff-login"),
    staff: restaurantEntryPathForSlug(slug, "/staff"),
    kitchen: restaurantEntryPathForSlug(slug, "/kitchen"),
    bar: restaurantEntryPathForSlug(slug, "/bar"),
    manager: restaurantEntryPathForSlug(slug, "/manager"),
    admin: restaurantEntryPathForSlug(slug, "/admin"),
    payTable1: restaurantEntryPathForSlug(slug, "/pay/1"),
  }
}

export function salesDemoEntryPath(nextPath = "/sales-demo") {
  return restaurantEntryPathForSlug(getSalesDemoSlug(), nextPath)
}

export function readCookieValue(
  cookieHeader: string | null,
  key: string
) {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(";")
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split("=")
    if (rawKey === key) {
      return decodeURIComponent(rest.join("="))
    }
  }
  return null
}

export function inferRestaurantSlugFromHost(host: string | null) {
  if (!host) return null
  const hostWithoutPort = host.split(":")[0]?.trim().toLowerCase() ?? ""
  if (!hostWithoutPort) return null
  if (isPlatformHost(hostWithoutPort)) {
    return null
  }
  if (
    isIpv4Host(hostWithoutPort) ||
    isLikelyIpv6Host(hostWithoutPort)
  ) {
    return null
  }
  const hostParts = hostWithoutPort.split(".").filter(Boolean)
  if (hostParts.length < 2) return null
  const candidate = hostParts[0]
  if (!candidate || RESERVED_HOST_PARTS.has(candidate)) {
    return null
  }
  return normalizeRestaurantSlug(candidate)
}

export function resolveRestaurantSlugFromRequest(req: Request) {
  const url = new URL(req.url)
  const allowTenantOverride =
    isTenantOverrideAllowedInRequestResolution()

  if (allowTenantOverride) {
    const fromQuery = normalizeRestaurantSlug(
      url.searchParams.get("restaurant")
    )
    if (fromQuery) return fromQuery

    const fromHeader = normalizeRestaurantSlug(
      req.headers.get("x-restaurant-slug")
    )
    if (fromHeader) return fromHeader
  }

  const fromCookie = normalizeRestaurantSlug(
    readCookieValue(req.headers.get("cookie"), RESTAURANT_COOKIE_NAME)
  )
  if (fromCookie) return fromCookie

  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  const fromHost = inferRestaurantSlugFromHost(host)
  if (fromHost) return fromHost

  return getDefaultRestaurantSlug()
}
