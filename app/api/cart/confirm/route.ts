import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { appendSystemEvent } from "@/lib/events"
import {
  getEditClientKey,
  withEditConfirmation,
} from "@/lib/itemEdits"

function normalizeClientKey(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(req: Request) {
  const body = await req.json()
  const sessionId = String(body?.sessionId ?? "")
  const requesterClientKey = normalizeClientKey(
    body?.clientKey
  )

  if (!sessionId || !requesterClientKey) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 })
  }

  const cart = await prisma.sessionCart.findUnique({
    where: { sessionId },
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
      confirmed: false,
      updated: 0,
    })
  }

  for (const item of ownedItems) {
    const nextEdits = withEditConfirmation(
      item.edits,
      true,
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

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      lastActivityAt: new Date(),
    },
  })

  await appendSystemEvent(
    "member_items_confirmed",
    {
      sessionId,
      itemCount: ownedItems.length,
    },
    {
      req,
      sessionId,
      tableId: cart.session.tableId,
    }
  )

  return NextResponse.json({
    confirmed: true,
    updated: ownedItems.length,
  })
}
