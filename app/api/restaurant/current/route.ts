import { NextResponse } from "next/server"
import {
  getBrandingConfig,
  resolveRestaurantFromRequest,
} from "@/lib/restaurants"

export async function GET(req: Request) {
  const restaurant = await resolveRestaurantFromRequest(req)
  const branding = getBrandingConfig({
    name: restaurant.name,
    logoUrl: restaurant.logoUrl,
    primaryColor: restaurant.primaryColor,
    secondaryColor: restaurant.secondaryColor,
    vatRate: restaurant.vatRate,
    serviceCharge: restaurant.serviceCharge,
  })

  return NextResponse.json({
    restaurant: {
      id: restaurant.id,
      slug: restaurant.slug,
      domain: restaurant.domain,
      ...branding,
    },
  })
}
