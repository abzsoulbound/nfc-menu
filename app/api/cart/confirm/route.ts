import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { appendSystemEvent } from "@/lib/events"
import {
  getEditClientKey,
  withEditConfirmation,
} from "@/lib/itemEdits"
import {
  apiErrorResponse,
  jsonWithTenantRequestId,
  withTenant,
} from "@/lib/api/withTenant"

function normalizeClientKey(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(req: Request) {
  return withTenant(req, async ({ requestId, restaurant }) => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return apiErrorResponse({
        requestId,
        error: "BAD_REQUEST",
        status: 400,
        message: "Invalid JSON request body.",
      })
    }

    const payload =
      body && typeof body === "object"
        ? (body as Record<string, unknown>)
        : {}
    const sessionId = String(payload.sessionId ?? "")
    const requesterClientKey = normalizeClientKey(
      payload.clientKey
    )
    const confirmed =
      typeof payload.confirmed === "boolean"
        ? payload.confirmed
        : true

    if (!sessionId || !requesterClientKey) {
      return apiErrorResponse({
        requestId,
        error: "BAD_REQUEST",
        status: 400,
        message: "Session ID and client key are required.",
      })
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
      return apiErrorResponse({
        requestId,
        error: "SESSION_NOT_FOUND",
        status: 404,
      })
    }

    const ownedItems = cart.items.filter(
      item => getEditClientKey(item.edits) === requesterClientKey
    )

    if (ownedItems.length === 0) {
      return jsonWithTenantRequestId(
        {
          confirmed,
          updated: 0,
        },
        requestId
      )
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

    return jsonWithTenantRequestId(
      {
        confirmed,
        updated: ownedItems.length,
      },
      requestId
    )
  })
}
