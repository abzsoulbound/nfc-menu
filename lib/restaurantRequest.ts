import { badRequest } from "@/lib/http"
import { withRestaurantContext } from "@/lib/tenantContext"
import { resolveRestaurantSlugFromRequest } from "@/lib/tenant"
import {
  requireRestaurantForSlug,
  type RestaurantProfile,
} from "@/lib/restaurants"

export async function withRestaurantRequestContext<T>(
  req: Request,
  run: (context: {
    restaurant: RestaurantProfile
    restaurantSlug: string
  }) => Promise<T> | T
): Promise<T | Response> {
  const requestedSlug = resolveRestaurantSlugFromRequest(req)
  let restaurant: RestaurantProfile

  try {
    restaurant = await requireRestaurantForSlug(requestedSlug)
  } catch (error) {
    return badRequest((error as Error).message, 404, {
      code: "RESTAURANT_NOT_FOUND",
      req,
    })
  }

  return withRestaurantContext(restaurant.slug, () =>
    run({
      restaurant,
      restaurantSlug: restaurant.slug,
    })
  )
}
