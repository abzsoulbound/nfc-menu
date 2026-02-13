import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { appendSystemEvent } from "@/lib/events"
import {
  getEditClientKey,
  withEditConfirmation,
} from "@/lib/itemEdits"
import { resolveRestaurantFromRequest } from "@/lib/restaurants"

function normalizeClientKey(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(req: Request) {
  const restaurant = await resolveRestaurantFromRequest(req)
  const body = await req.json()
  const sessionId = String(body?.sessionId ?? "")
  const requesterClientKey = normalizeClientKey(
    body?.clientKey
  )
  const confirmed =
    typeof body?.confirmed === "boolean"
      ? body.confirmed
      : true

  if (!sessionId || !requesterClientKey) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
  }

  const cart = await prisma.sessionCart.findFirst({
    where: {
      sessionId,
      restaurantId: restaurant.id,
    },
    include: {
      items: true,
      session: true,
    },
  })

  if (!cart) {
    return NextResponse.json(
      { error: "SESSION_NOT_FOUND" },
      { status: 404 }
    )
  }

  const ownedItems = cart.items.filter(
    item => getEditClientKey(item.edits) === requesterClientKey
  )

  if (ownedItems.length === 0) {
    return NextResponse.json({
      confirmed,
      updated: 0,
    })
  }

  for (const item of ownedItems) {
    const nextEdits = withEditConfirmation(
      item.edits,
      confirmed,
      requesterClientKey
    )

    await prisma.cartItem.update({
      where: { id: item.id },
      data: {
        edits:
          nextEdits === null
            ? Prisma.JsonNull
            : nextEdits === undefined
            ? undefined
            : (nextEdits as Prisma.InputJsonValue),
      },
    })
  }

  await prisma.session.updateMany({
    where: {
      id: sessionId,
      restaurantId: restaurant.id,
    },
    data: {
      lastActivityAt: new Date(),
    },
  })

  await appendSystemEvent(
    confirmed
      ? "member_items_confirmed"
      : "member_items_unconfirmed",
    {
      sessionId,
      itemCount: ownedItems.length,
    },
    {
      req,
      restaurantId: restaurant.id,
      sessionId,
      tableId: cart.session.tableId,
    }
  )

  return NextResponse.json({
    confirmed,
    updated: ownedItems.length,
  })
}
