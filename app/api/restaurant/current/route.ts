import {
  getBrandingConfig,
} from "@/lib/restaurants"
import {
  jsonWithTenantRequestId,
  withTenant,
} from "@/lib/api/withTenant"

export async function GET(req: Request) {
  return withTenant(req, async ({ requestId, restaurant }) => {
    const branding = getBrandingConfig({
      name: restaurant.name,
      logoUrl: restaurant.logoUrl,
      primaryColor: restaurant.primaryColor,
      secondaryColor: restaurant.secondaryColor,
      vatRate: restaurant.vatRate,
      serviceCharge: restaurant.serviceCharge,
    })

    return jsonWithTenantRequestId(
      {
        restaurant: {
          id: restaurant.id,
          slug: restaurant.slug,
          domain: restaurant.domain,
          ...branding,
        },
      },
      requestId
    )
  })
}
