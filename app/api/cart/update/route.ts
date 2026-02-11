import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { appendSystemEvent } from '@/lib/events'
import { ASSIST_EDIT_UNLOCK_MS } from '@/lib/constants'
import {
  getEditClientKey,
  getEditHardActivityAt,
  withEditConfirmation,
} from '@/lib/itemEdits'

function normalizeClientKey(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(req: Request) {
  const body = await req.json()
  const sessionId = String(body?.sessionId ?? '')
  const itemId = String(body?.itemId ?? '')
  const hasQuantity = typeof body?.quantity === 'number'
  const hasEdits = Object.prototype.hasOwnProperty.call(
    body ?? {},
    'edits'
  )
  const quantity = Number(body?.quantity ?? 0)

  if (!sessionId || !itemId || (!hasQuantity && !hasEdits)) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }
  if (
    hasQuantity &&
    (!Number.isInteger(quantity) || quantity < 0)
  ) {
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
  if (!item || item.cart.sessionId !== sessionId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const requesterClientKey = normalizeClientKey(
    body?.clientKey
  )
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

  if (hasQuantity && quantity === 0) {
    await prisma.cartItem.delete({
      where: { id: itemId }
    })

    await prisma.session.update({
      where: { id: sessionId },
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
        sessionId,
        tableId: item.cart.session.tableId
      }
    )

    return NextResponse.json({ removed: true, id: itemId })
  }

  const nextData: Prisma.CartItemUpdateInput = {}
  if (hasQuantity) {
    nextData.quantity = quantity
  }

  const keyForWrite = ownerClientKey ?? requesterClientKey
  if (hasEdits || hasQuantity) {
    const nextEditsSource = hasEdits ? body?.edits : item.edits
    const editsWithMeta = withEditConfirmation(
      nextEditsSource,
      false,
      keyForWrite,
      {
        touchHardActivity: !isAssistEdit,
      }
    )

    if (editsWithMeta === null) {
      nextData.edits = Prisma.JsonNull
    } else if (editsWithMeta !== undefined) {
      nextData.edits = editsWithMeta as Prisma.InputJsonValue
    }
  }

  const updated = await prisma.cartItem.update({
    where: { id: itemId },
    data: nextData
  })

  await prisma.session.update({
    where: { id: sessionId },
    data: { lastActivityAt: new Date() }
  })

  if (hasQuantity) {
    await appendSystemEvent(
      isAssistEdit ? 'assist_item_quantity_updated' : 'item_quantity_updated',
      isAssistEdit
        ? {
            itemId: updated.id,
            quantity: updated.quantity,
            ownerClientKey,
            actorClientKey: requesterClientKey,
            ownerHardActivityAt,
          }
        : {
            itemId: updated.id,
            quantity: updated.quantity
          },
      {
        req,
        sessionId,
        tableId: item.cart.session.tableId
      }
    )
  }

  if (hasEdits) {
    await appendSystemEvent(
      isAssistEdit ? 'assist_item_edited' : 'item_edited',
      isAssistEdit
        ? {
            itemId: updated.id,
            ownerClientKey,
            actorClientKey: requesterClientKey,
            ownerHardActivityAt,
          }
        : {
            itemId: updated.id
          },
      {
        req,
        sessionId,
        tableId: item.cart.session.tableId
      }
    )
  }

  return NextResponse.json(updated)
}
