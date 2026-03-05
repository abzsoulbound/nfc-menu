import { AsyncLocalStorage } from "node:async_hooks"
import {
  getDefaultRestaurantSlug,
  normalizeRestaurantSlug,
} from "@/lib/tenant"

type TenantContextValue = {
  restaurantSlug: string
}

const globalForTenantContext = globalThis as unknown as {
  __NFC_TENANT_CONTEXT__?: AsyncLocalStorage<TenantContextValue>
}

function tenantContextStore() {
  if (!globalForTenantContext.__NFC_TENANT_CONTEXT__) {
    globalForTenantContext.__NFC_TENANT_CONTEXT__ =
      new AsyncLocalStorage<TenantContextValue>()
  }
  return globalForTenantContext.__NFC_TENANT_CONTEXT__
}

function sanitizeRestaurantSlug(value: string | undefined) {
  return (
    normalizeRestaurantSlug(value) ?? getDefaultRestaurantSlug()
  )
}

export function withRestaurantContext<T>(
  restaurantSlug: string,
  run: () => T
) {
  const sanitized = sanitizeRestaurantSlug(restaurantSlug)
  return tenantContextStore().run({ restaurantSlug: sanitized }, run)
}

export function getRestaurantContextSlug() {
  return (
    tenantContextStore().getStore()?.restaurantSlug ??
    getDefaultRestaurantSlug()
  )
}
