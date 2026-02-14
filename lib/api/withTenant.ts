import { NextResponse } from "next/server"
import { getRequestIdFromHeaders, withRequestId } from "@/lib/apiResponse"
import { prisma } from "@/lib/prisma"
import { getRestaurantBySlug, resolveRestaurantFromRequest } from "@/lib/restaurants"

type RestaurantContext = Awaited<
  ReturnType<typeof resolveRestaurantFromRequest>
>

type TenantFailureCode =
  | "TENANT_CONTEXT_MISSING"
  | "TENANT_CONTEXT_INVALID"

type TenantFailure = {
  ok: false
  code: TenantFailureCode
  status: number
  message: string
}

type TenantSuccess = {
  ok: true
  restaurant: RestaurantContext
}

export type TenantRouteContext = {
  requestId: string
  restaurant: RestaurantContext
}

export type WithTenantOptions = {
  restaurantSlug?: string | null
  tagId?: string | null
  sessionId?: string | null
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

function normalizeTag(value: string | null | undefined) {
  if (!value) return ""
  return value.trim().slice(0, 128)
}

function parsePathSlug(pathname: string) {
  const direct = pathname.match(/^\/(?:order\/)?r\/([^/]+)/i)
  if (!direct?.[1]) return ""
  try {
    return normalizeSlug(decodeURIComponent(direct[1]))
  } catch {
    return normalizeSlug(direct[1])
  }
}

function parsePathTag(pathname: string) {
  const direct = pathname.match(/^\/(?:order\/)?(?:r\/[^/]+\/)?t\/([^/]+)/i)
  if (!direct?.[1]) return ""
  try {
    return normalizeTag(decodeURIComponent(direct[1]))
  } catch {
    return normalizeTag(direct[1])
  }
}

function parseCookie(rawCookie: string | null, key: string) {
  if (!rawCookie) return ""
  const prefix = `${key}=`
  const part = rawCookie
    .split(";")
    .map(value => value.trim())
    .find(value => value.startsWith(prefix))
  if (!part) return ""
  try {
    return decodeURIComponent(part.slice(prefix.length))
  } catch {
    return part.slice(prefix.length)
  }
}

function normalizeSessionId(value: unknown) {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  if (!trimmed) return ""
  return trimmed.slice(0, 128)
}

function extractObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

async function readBodyHints(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") {
    return {
      sessionId: "",
      tagId: "",
      restaurantSlug: "",
    }
  }

  const contentType = req.headers.get("content-type") ?? ""
  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      sessionId: "",
      tagId: "",
      restaurantSlug: "",
    }
  }

  try {
    const payload = extractObject(await req.clone().json())
    return {
      sessionId: normalizeSessionId(payload.sessionId),
      tagId: normalizeTag(
        typeof payload.tagId === "string" ? payload.tagId : ""
      ),
      restaurantSlug: normalizeSlug(
        typeof payload.restaurantSlug === "string"
          ? payload.restaurantSlug
          : ""
      ),
    }
  } catch {
    return {
      sessionId: "",
      tagId: "",
      restaurantSlug: "",
    }
  }
}

function asContext(input: {
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
    id: input.id,
    slug: input.slug,
    name: input.name,
    logoUrl: input.logoUrl,
    primaryColor: input.primaryColor,
    secondaryColor: input.secondaryColor,
    domain: input.domain,
    vatRate: input.vatRate,
    serviceCharge: input.serviceCharge,
  }
}

function tenantError(
  code: TenantFailureCode,
  message: string
): TenantFailure {
  return {
    ok: false,
    code,
    status: code === "TENANT_CONTEXT_MISSING" ? 400 : 403,
    message,
  }
}

async function resolveTenantWithFallback(
  req: Request,
  options: WithTenantOptions
): Promise<TenantSuccess | TenantFailure> {
  try {
    const restaurant = await resolveRestaurantFromRequest(req, {
      restaurantSlug: options.restaurantSlug ?? null,
    })
    return { ok: true, restaurant }
  } catch {
    // Fall through to fallback hint resolution.
  }

  const url = new URL(req.url)
  const refererRaw = req.headers.get("referer")
  let refererUrl: URL | null = null
  try {
    refererUrl = refererRaw ? new URL(refererRaw) : null
  } catch {
    refererUrl = null
  }

  const bodyHints = await readBodyHints(req)
  const slugCandidates = [
    normalizeSlug(options.restaurantSlug),
    normalizeSlug(url.searchParams.get("restaurantSlug")),
    normalizeSlug(bodyHints.restaurantSlug),
    parsePathSlug(url.pathname),
    refererUrl ? normalizeSlug(refererUrl.searchParams.get("restaurantSlug")) : "",
    refererUrl ? parsePathSlug(refererUrl.pathname) : "",
    normalizeSlug(parseCookie(req.headers.get("cookie"), "restaurant_slug")),
  ].filter(Boolean)

  for (const slug of slugCandidates) {
    const bySlug = await getRestaurantBySlug(slug)
    if (bySlug) {
      return {
        ok: true,
        restaurant: asContext(bySlug),
      }
    }
  }

  const sessionCandidates = [
    normalizeSessionId(options.sessionId),
    normalizeSessionId(url.searchParams.get("sessionId")),
    normalizeSessionId(bodyHints.sessionId),
    refererUrl ? normalizeSessionId(refererUrl.searchParams.get("sessionId")) : "",
  ].filter(Boolean)

  for (const sessionId of sessionCandidates) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        restaurant: true,
      },
    })
    if (session?.restaurant) {
      return {
        ok: true,
        restaurant: asContext(session.restaurant),
      }
    }
  }

  const tagCandidates = [
    normalizeTag(options.tagId),
    normalizeTag(url.searchParams.get("tagId")),
    normalizeTag(bodyHints.tagId),
    parsePathTag(url.pathname),
    refererUrl ? normalizeTag(refererUrl.searchParams.get("tagId")) : "",
    refererUrl ? parsePathTag(refererUrl.pathname) : "",
  ].filter(Boolean)

  for (const tagId of tagCandidates) {
    const tags = await prisma.nfcTag.findMany({
      where: { tagId },
      include: {
        restaurant: true,
      },
      take: 2,
    })

    if (tags.length === 1 && tags[0]?.restaurant) {
      return {
        ok: true,
        restaurant: asContext(tags[0].restaurant),
      }
    }
    if (tags.length > 1) {
      return tenantError(
        "TENANT_CONTEXT_INVALID",
        "Table link is ambiguous across tenants."
      )
    }
  }

  const hadTenantHints =
    slugCandidates.length > 0 ||
    tagCandidates.length > 0 ||
    sessionCandidates.length > 0

  if (hadTenantHints) {
    return tenantError(
      "TENANT_CONTEXT_INVALID",
      "Table link could not be validated for this tenant."
    )
  }

  return tenantError(
    "TENANT_CONTEXT_MISSING",
    "Tenant context is missing from this request."
  )
}

export function apiErrorResponse(input: {
  requestId: string
  error: string
  status: number
  message?: string
}) {
  return withRequestId(
    {
      error: input.error,
      message: input.message,
      requestId: input.requestId,
    },
    { status: input.status },
    input.requestId
  )
}

export async function withTenant(
  req: Request,
  handler: (context: TenantRouteContext) => Promise<Response>,
  options: WithTenantOptions = {}
) {
  const requestId = getRequestIdFromHeaders(req.headers)
  const tenantResult = await resolveTenantWithFallback(req, options)

  if (!tenantResult.ok) {
    return apiErrorResponse({
      requestId,
      error: tenantResult.code,
      status: tenantResult.status,
      message: tenantResult.message,
    })
  }

  try {
    const response = await handler({
      requestId,
      restaurant: tenantResult.restaurant,
    })

    response.headers.set("x-request-id", requestId)
    return response
  } catch (error) {
    console.error("api_with_tenant_unhandled_error", {
      requestId,
      path: new URL(req.url).pathname,
      error,
    })

    return apiErrorResponse({
      requestId,
      error: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unexpected server error.",
    })
  }
}

export function jsonWithTenantRequestId<T>(
  payload: T,
  requestId: string,
  init?: ResponseInit
) {
  const response = NextResponse.json(payload, init)
  response.headers.set("x-request-id", requestId)
  return response
}
