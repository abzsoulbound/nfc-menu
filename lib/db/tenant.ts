import { DEFAULT_RESTAURANT_ID } from "@/lib/restaurantConstants"

type HeaderLike = {
  get: (key: string) => string | null
}

export class MissingTenantContextError extends Error {
  constructor(message = "TENANT_CONTEXT_MISSING") {
    super(message)
    this.name = "MissingTenantContextError"
  }
}

function readHeader(headers: HeaderLike, key: string) {
  const value = headers.get(key)
  if (typeof value !== "string") return ""
  return value.trim()
}

export function getRestaurantIdOrThrow(headers: HeaderLike): string {
  const restaurantId = readHeader(headers, "x-restaurant-id")
  if (!restaurantId) {
    throw new MissingTenantContextError("x-restaurant-id header missing")
  }
  return restaurantId
}

export function getRequestId(headers: HeaderLike): string {
  return readHeader(headers, "x-request-id") || crypto.randomUUID()
}

export function requireRestaurantContext(headers: HeaderLike) {
  const restaurantId = getRestaurantIdOrThrow(headers)
  const requestId = getRequestId(headers)

  return {
    restaurantId,
    requestId,
    isDefaultRestaurant: restaurantId === DEFAULT_RESTAURANT_ID,
  }
}

export function tenantWhere<T extends Record<string, unknown>>(
  restaurantId: string,
  where?: T
): T & { restaurantId: string } {
  return {
    ...(where ?? ({} as T)),
    restaurantId,
  }
}

export function tenantData<T extends Record<string, unknown>>(
  restaurantId: string,
  data?: T
): T & { restaurantId: string } {
  return {
    ...(data ?? ({} as T)),
    restaurantId,
  }
}
