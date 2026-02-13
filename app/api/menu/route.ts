import { NextResponse } from "next/server"
import { isMenuLocked } from "@/lib/menu"
import { menu as fallbackMenu } from "@/lib/menu-data"
import { resolveRestaurantFromRequest } from "@/lib/restaurants"

export async function GET(req: Request) {
  const restaurant = await resolveRestaurantFromRequest(req)

  try {
    const { getCanonicalMenu } = await import("@/lib/menuCatalog")
    const menu = await getCanonicalMenu({
      restaurantId: restaurant.id,
      restaurantSlug: restaurant.slug,
    })

    return NextResponse.json({
      menu,
      locked: isMenuLocked(),
      source: "db",
      restaurant: {
        id: restaurant.id,
        slug: restaurant.slug,
        name: restaurant.name,
      },
    })
  } catch (error) {
    console.error("menu_get_failed_using_fallback", error)
    return NextResponse.json({
      menu: fallbackMenu,
      locked: isMenuLocked(),
      source: "fallback",
      restaurant: {
        id: restaurant.id,
        slug: restaurant.slug,
        name: restaurant.name,
      },
    })
  }
}

export async function PATCH(req: Request) {
  const [{ requireStaff }, { prisma }, { appendSystemEvent }] =
    await Promise.all([
      import("@/lib/auth"),
      import("@/lib/prisma"),
      import("@/lib/events"),
    ])

  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const restaurant = await resolveRestaurantFromRequest(req)

  const body = await req.json()
  const itemId = String(body?.itemId ?? "")
  const available = body?.available

  if (!itemId || typeof available !== "boolean") {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
  }

  const updateResult = await prisma.menuItem.updateMany({
    where: {
      id: itemId,
      restaurantId: restaurant.id,
    },
    data: { available },
  })
  if (updateResult.count === 0) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
  }

  const item = await prisma.menuItem.findUnique({
    where: { id: itemId },
    select: { id: true, available: true, restaurantId: true },
  })
  if (!item || item.restaurantId !== restaurant.id) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
  }

  await appendSystemEvent(
    "menu_item_availability_changed",
    { itemId: item.id, available },
    { req, restaurantId: restaurant.id }
  )

  return NextResponse.json({
    id: item.id,
    available: item.available,
  })
}
