export const runtime = 'nodejs'

import { prisma } from '@/lib/prisma'
import { appendSystemEvent } from '@/lib/events'
import { ASSIST_EDIT_UNLOCK_MS } from '@/lib/constants'
import {
  getEditClientKey,
  getEditHardActivityAt,
} from '@/lib/itemEdits'
import {
  apiErrorResponse,
  jsonWithTenantRequestId,
  withTenant,
} from '@/lib/api/withTenant'

function normalizeClientKey(value: unknown): string | null {
  if (typeof value !== 'string') return null
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
        error: 'BAD_REQUEST',
        status: 400,
        message: 'Invalid JSON request body.',
      })
    }

    const payload =
      body && typeof body === 'object'
        ? (body as Record<string, unknown>)
        : {}
    const sessionId = String(payload.sessionId ?? '')
    const itemId = String(payload.itemId ?? '')
    const clientKey = payload.clientKey

    if (!sessionId || !itemId) {
      return apiErrorResponse({
        requestId,
        error: 'BAD_REQUEST',
        status: 400,
        message: 'Session ID and item ID are required.',
      })
    }

    const item = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        cart: {
          include: { session: true },
        },
      },
    })
    if (
      !item ||
      item.restaurantId !== restaurant.id ||
      item.cart.session.restaurantId !== restaurant.id ||
      item.cart.sessionId !== sessionId
    ) {
      return apiErrorResponse({
        requestId,
        error: 'FORBIDDEN',
        status: 403,
      })
    }

    const requesterClientKey = normalizeClientKey(clientKey)
    const ownerClientKey = getEditClientKey(item.edits)
    const ownerHardActivityAt =
      getEditHardActivityAt(item.edits) ??
      item.updatedAt.toISOString()
    const ownerIdleForMs =
      Date.now() - new Date(ownerHardActivityAt).getTime()
    const assistUnlocked = ownerIdleForMs >= ASSIST_EDIT_UNLOCK_MS
    const isAssistEdit = Boolean(
      ownerClientKey &&
      ownerClientKey !== requesterClientKey
    )
    if (isAssistEdit) {
      if (!requesterClientKey) {
        return apiErrorResponse({
          requestId,
          error: 'FORBIDDEN',
          status: 403,
        })
      }
      if (!assistUnlocked) {
        return apiErrorResponse({
          requestId,
          error: 'ASSIST_LOCKED',
          status: 403,
          message: 'Assist edit is currently locked for this item.',
        })
      }
    }

    await prisma.cartItem.delete({
      where: { id: itemId },
    })

    await prisma.session.updateMany({
      where: {
        id: sessionId,
        restaurantId: restaurant.id,
      },
      data: { lastActivityAt: new Date() },
    })

    await appendSystemEvent(
      isAssistEdit ? 'assist_item_removed' : 'item_removed',
      isAssistEdit
        ? {
            itemId,
            name: item.name,
            ownerClientKey,
            actorClientKey: requesterClientKey,
            ownerHardActivityAt,
          }
        : {
            itemId,
            name: item.name,
          },
      {
        req,
        restaurantId: restaurant.id,
        sessionId,
        tableId: item.cart.session.tableId,
      }
    )

    return jsonWithTenantRequestId({ removed: true }, requestId)
  })
}
