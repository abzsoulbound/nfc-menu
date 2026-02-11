import { NextResponse } from "next/server"
import { isMenuLocked } from "@/lib/menu"
import { menu as fallbackMenu } from "@/lib/menu-data"

export async function GET() {
  try {
    const { getCanonicalMenu } = await import("@/lib/menuCatalog")
    const menu = await getCanonicalMenu()

    return NextResponse.json({
      menu,
      locked: isMenuLocked(),
      source: "db",
    })
  } catch (error) {
    console.error("menu_get_failed_using_fallback", error)
    return NextResponse.json({
      menu: fallbackMenu,
      locked: isMenuLocked(),
      source: "fallback",
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

  const body = await req.json()
  const itemId = String(body?.itemId ?? "")
  const available = body?.available

  if (!itemId || typeof available !== "boolean") {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
  }

  const item = await prisma.menuItem.update({
    where: { id: itemId },
    data: { available },
  })

  await appendSystemEvent(
    "menu_item_availability_changed",
    { itemId: item.id, available },
    { req }
  )

  return NextResponse.json({
    id: item.id,
    available: item.available,
  })
}
