import { NextResponse } from "next/server"
import { getRequestIdFromHeaders, withRequestId } from "@/lib/apiResponse"
import { resolveRestaurantFromRequest } from "@/lib/restaurants"

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
  tagId?: string | null
  sessionId?: string | null
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
  req: Request
): Promise<TenantSuccess | TenantFailure> {
  try {
    const restaurant = await resolveRestaurantFromRequest(req)
    return { ok: true, restaurant }
  } catch {
    return tenantError(
      "TENANT_CONTEXT_INVALID",
      "Tenant could not be resolved from domain."
    )
  }
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
  void options
  const tenantResult = await resolveTenantWithFallback(req)

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
