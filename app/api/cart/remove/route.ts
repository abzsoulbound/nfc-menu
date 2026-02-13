import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { appendSystemEvent } from '@/lib/events'
import { ASSIST_EDIT_UNLOCK_MS } from '@/lib/constants'
import {
  getEditClientKey,
  getEditHardActivityAt,
} from '@/lib/itemEdits'
import { resolveRestaurantFromRequest } from '@/lib/restaurants'

function normalizeClientKey(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(req: Request) {
  const restaurant = await resolveRestaurantFromRequest(req)
  const { sessionId, itemId, clientKey } = await req.json()
  if (!sessionId || !itemId) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: {
      cart: {
        include: { session: true }
      }
    }
  })
  if (
    !item ||
    item.restaurantId !== restaurant.id ||
    item.cart.session.restaurantId !== restaurant.id ||
    item.cart.sessionId !== sessionId
  ) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
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
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }
    if (!assistUnlocked) {
      return NextResponse.json(
        { error: 'ASSIST_LOCKED' },
        { status: 403 }
      )
    }
  }

  await prisma.cartItem.delete({
    where: { id: itemId }
  })

  await prisma.session.updateMany({
    where: {
      id: sessionId,
      restaurantId: restaurant.id,
    },
    data: { lastActivityAt: new Date() }
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
          name: item.name
        },
    {
      req,
      restaurantId: restaurant.id,
      sessionId,
      tableId: item.cart.session.tableId
    }
  )

  return NextResponse.json({ removed: true })
}
