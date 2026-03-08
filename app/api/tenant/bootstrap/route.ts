import { getRolePermissionMatrix, requireRole } from "@/lib/auth"
import { getPaymentMode, getRuntimeFeatureFlags } from "@/lib/env"
import { ok } from "@/lib/http"
import { withRestaurantRequestContext } from "@/lib/restaurantRequest"
import { listActiveRestaurants } from "@/lib/restaurants"
import { buildRestaurantScopedLinks } from "@/lib/tenant"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  return withRestaurantRequestContext(req, async ({ restaurant }) => {
    let availableRestaurants: Awaited<ReturnType<typeof listActiveRestaurants>> = []
    try {
      requireRole(["MANAGER", "ADMIN"], req)
      availableRestaurants = await listActiveRestaurants()
    } catch {
      availableRestaurants = [restaurant]
    }

    return ok(
      {
        restaurant,
        resolvedFeatures: restaurant.resolvedFeatures,
        links: buildRestaurantScopedLinks(restaurant.slug),
        features: getRuntimeFeatureFlags(),
        payment: {
          mode: getPaymentMode(),
        },
        permissions: getRolePermissionMatrix(),
        availableRestaurants: availableRestaurants.map(entry => ({
          slug: entry.slug,
          name: entry.name,
          monogram: entry.monogram,
          location: entry.location,
          isDemo: entry.isDemo,
          planTier: entry.planTier,
          billingStatus: entry.billingStatus,
          links: buildRestaurantScopedLinks(entry.slug),
        })),
      },
      undefined,
      req
    )
  })
}
