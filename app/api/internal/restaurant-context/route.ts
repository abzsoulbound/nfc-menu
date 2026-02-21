export const runtime = 'nodejs'

import { NextResponse } from "next/server"
import {
  normalizeDomain,
  resolveRestaurantContext,
} from "@/lib/restaurants"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  if (req.headers.get("x-internal-restaurant-resolver") !== "1") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "cache-control": "no-store",
      },
    })
  }

  const { searchParams } = new URL(req.url)
  const hostname = normalizeDomain(searchParams.get("hostname"))

  try {
    const restaurant = await resolveRestaurantContext({
      hostname,
    })

    return NextResponse.json(
      {
        restaurant: {
          id: restaurant.id,
          slug: restaurant.slug,
          name: restaurant.name,
          logoUrl: restaurant.logoUrl,
          primaryColor: restaurant.primaryColor,
          secondaryColor: restaurant.secondaryColor,
          domain: restaurant.domain,
          vatRate: restaurant.vatRate,
          serviceCharge: restaurant.serviceCharge,
        },
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      }
    )
  } catch (error) {
    console.error("restaurant_context_resolution_error", {
      hostname,
      error: String(error),
      message: error instanceof Error ? error.message : "Unknown error",
    })
    return NextResponse.json(
      { error: "TENANT_RESOLUTION_FAILED" },
      { status: 500 }
    )
  }
}
