import { prisma } from "@/lib/prisma"
import {
  DEFAULT_RESTAURANT_BRANDING,
  DEFAULT_ORDER_BASE_PATH,
  DEFAULT_RESTAURANT_ID,
  DEFAULT_RESTAURANT_SLUG,
  RESTAURANT_COOKIE,
} from "@/lib/restaurantConstants"
import { requireRestaurantContext } from "@/lib/db/tenant"

export {
  DEFAULT_RESTAURANT_BRANDING,
  DEFAULT_RESTAURANT_ID,
  DEFAULT_RESTAURANT_SLUG,
  RESTAURANT_COOKIE,
}

const DEFAULT_BRANDING = DEFAULT_RESTAURANT_BRANDING

type HeaderLike = {
  get: (key: string) => string | null
}

type RestaurantContext = {
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

function parseCookieValue(rawCookie: string | null, key: string) {
  if (!rawCookie) return null
  const prefix = `${key}=`
  const part = rawCookie
    .split(";")
    .map(value => value.trim())
    .find(value => value.startsWith(prefix))
  if (!part) return null
  const rawValue = part.slice(prefix.length)
  try {
    return decodeURIComponent(rawValue)
  } catch {
    return rawValue
  }
}

function normalizeSlug(value: string | null | undefined) {
  if (!value) return ""
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export function normalizeDomain(value: string | null | undefined) {
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

function hostFromHeaders(headers: HeaderLike) {
  const host = headers.get("x-forwarded-host") ?? headers.get("host")
  const normalized = normalizeDomain(host)
  return normalized || null
}

function slugFromPath(pathname: string) {
  const match = pathname.match(/^\/(?:order\/)?r\/([^/]+)/i)
  if (!match?.[1]) return ""
  return normalizeSlug(match[1])
}

export async function ensureDefaultRestaurant() {
  return prisma.restaurant.upsert({
    where: { slug: DEFAULT_RESTAURANT_SLUG },
    update: {
      name: DEFAULT_BRANDING.name,
      logoUrl: DEFAULT_BRANDING.logoUrl,
      primaryColor: DEFAULT_BRANDING.primaryColor,
      secondaryColor: DEFAULT_BRANDING.secondaryColor,
      vatRate: DEFAULT_BRANDING.vatRate,
      serviceCharge: DEFAULT_BRANDING.serviceCharge,
    },
    create: {
      id: DEFAULT_RESTAURANT_ID,
      slug: DEFAULT_RESTAURANT_SLUG,
      name: DEFAULT_BRANDING.name,
      logoUrl: DEFAULT_BRANDING.logoUrl,
      primaryColor: DEFAULT_BRANDING.primaryColor,
      secondaryColor: DEFAULT_BRANDING.secondaryColor,
      domain: DEFAULT_BRANDING.domain,
      vatRate: DEFAULT_BRANDING.vatRate,
      serviceCharge: DEFAULT_BRANDING.serviceCharge,
    },
  })
}

export async function getRestaurantBySlug(slug: string) {
  const normalized = normalizeSlug(slug)
  if (!normalized) return null

  if (normalized === DEFAULT_RESTAURANT_SLUG) {
    return ensureDefaultRestaurant()
  }

  return prisma.restaurant.findUnique({
    where: { slug: normalized },
  })
}

export async function resolveRestaurantByDomain(domain: string | null) {
  const normalizedDomain = normalizeDomain(domain)
  if (!normalizedDomain) return null
  return prisma.restaurant.findUnique({
    where: { domain: normalizedDomain },
  })
}

function toRestaurantContext(restaurant: {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  domain: string | null
  vatRate: number
  serviceCharge: number
}): RestaurantContext {
  return {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    logoUrl: restaurant.logoUrl,
    primaryColor: restaurant.primaryColor,
    secondaryColor: restaurant.secondaryColor,
    domain: normalizeDomain(restaurant.domain) || null,
    vatRate: restaurant.vatRate,
    serviceCharge: restaurant.serviceCharge,
  }
}

function parseRestaurantContextHeader(raw: string | null) {
  if (!raw) return null
  try {
    const decoded = raw.startsWith("{") ? raw : decodeURIComponent(raw)
    const parsed = JSON.parse(decoded) as Partial<RestaurantContext>

    if (
      !parsed ||
      typeof parsed !== "object" ||
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
          ? normalizeDomain(parsed.domain) || null
          : null,
      vatRate:
        typeof parsed.vatRate === "number" &&
        Number.isFinite(parsed.vatRate)
          ? parsed.vatRate
          : DEFAULT_BRANDING.vatRate,
      serviceCharge:
        typeof parsed.serviceCharge === "number" &&
        Number.isFinite(parsed.serviceCharge)
          ? parsed.serviceCharge
          : DEFAULT_BRANDING.serviceCharge,
    } satisfies RestaurantContext
  } catch {
    return null
  }
}

export async function resolveRestaurantContext(input: {
  hostname?: string | null
  slug?: string | null
}) {
  const normalizedHostname = normalizeDomain(input.hostname)
  if (normalizedHostname) {
    const byDomain = await resolveRestaurantByDomain(normalizedHostname)
    if (byDomain) return toRestaurantContext(byDomain)
  }

  const normalizedSlug = normalizeSlug(input.slug)
  if (normalizedSlug) {
    const bySlug = await getRestaurantBySlug(normalizedSlug)
    if (bySlug) return toRestaurantContext(bySlug)
  }

  return toRestaurantContext(await ensureDefaultRestaurant())
}

export async function resolveRestaurantFromRequest(req: Request, opts?: {
  restaurantSlug?: string | null
}) {
  const contextFromHeader = parseRestaurantContextHeader(
    req.headers.get("x-restaurant-context")
  )
  if (contextFromHeader) {
    return contextFromHeader
  }

  const tenantContext = requireRestaurantContext(req.headers)
  const byId = await prisma.restaurant.findUnique({
    where: { id: tenantContext.restaurantId },
  })
  if (byId) {
    return toRestaurantContext(byId)
  }

  if (tenantContext.restaurantId === DEFAULT_RESTAURANT_ID) {
    return toRestaurantContext(await ensureDefaultRestaurant())
  }

  const explicitSlug = normalizeSlug(opts?.restaurantSlug)
  const headerSlug = normalizeSlug(req.headers.get("x-restaurant-slug"))
  const fallbackSlug =
    explicitSlug || headerSlug || tenantContext.restaurantSlug
  const bySlug = await getRestaurantBySlug(fallbackSlug)
  if (bySlug) {
    return toRestaurantContext(bySlug)
  }

  throw new Error("TENANT_CONTEXT_INVALID")
}

export function getBrandingConfig(input: {
  name?: string | null
  logoUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  vatRate?: number | null
  serviceCharge?: number | null
}) {
  return {
    name: input.name || DEFAULT_BRANDING.name,
    logoUrl: input.logoUrl || DEFAULT_BRANDING.logoUrl,
    primaryColor: input.primaryColor || DEFAULT_BRANDING.primaryColor,
    secondaryColor: input.secondaryColor || DEFAULT_BRANDING.secondaryColor,
    vatRate:
      typeof input.vatRate === "number" && Number.isFinite(input.vatRate)
        ? input.vatRate
        : DEFAULT_BRANDING.vatRate,
    serviceCharge:
      typeof input.serviceCharge === "number" &&
      Number.isFinite(input.serviceCharge)
        ? input.serviceCharge
        : DEFAULT_BRANDING.serviceCharge,
  }
}

export function tenantPath(restaurantSlug: string, path: string) {
  const slug = normalizeSlug(restaurantSlug) || DEFAULT_RESTAURANT_SLUG
  const cleanPath = path.startsWith("/") ? path : `/${path}`
  const basePath = `${DEFAULT_ORDER_BASE_PATH}${cleanPath}`
  if (slug === DEFAULT_RESTAURANT_SLUG) {
    return basePath
  }
  const separator = basePath.includes("?") ? "&" : "?"
  return `${basePath}${separator}restaurantSlug=${encodeURIComponent(slug)}`
}

export function tenantOrderPath(restaurantSlug: string, tableId: string) {
  const slug = normalizeSlug(restaurantSlug) || DEFAULT_RESTAURANT_SLUG
  const basePath = `${DEFAULT_ORDER_BASE_PATH}/t/${encodeURIComponent(
    tableId
  )}`
  if (slug === DEFAULT_RESTAURANT_SLUG) {
    return basePath
  }
  return `${basePath}?restaurantSlug=${encodeURIComponent(slug)}`
}

export function externalOrderUrl(input: {
  baseUrl?: string | null
  restaurantSlug: string
  tableId: string
}) {
  const slug = normalizeSlug(input.restaurantSlug) || DEFAULT_RESTAURANT_SLUG
  const fallbackTenantPath = tenantOrderPath(slug, input.tableId)
  const domainPath = `/t/${encodeURIComponent(input.tableId)}`
  const baseUrl = input.baseUrl?.trim()
  if (!baseUrl) return fallbackTenantPath
  return `${baseUrl.replace(/\/+$/, "")}${domainPath}`
}
