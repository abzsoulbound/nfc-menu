export const runtime = 'nodejs'

import { NextResponse } from "next/server"
import {
  normalizeDomain,
  resolveRestaurantContext,
} from "@/lib/restaurants"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  if (req.headers.get("x-internal-restaurant-resolver") !== "1") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const hostname = normalizeDomain(searchParams.get("hostname"))

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
}
