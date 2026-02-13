import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { appendSystemEvent } from '@/lib/events'
import { ASSIST_EDIT_UNLOCK_MS } from '@/lib/constants'
import { resolveRestaurantFromRequest } from '@/lib/restaurants'
import {
  buildModifierSummary,
  calculateModifierDelta,
  collectModifierAllergens,
  getMenuItemCustomization,
  hasCustomization,
  validateModifierSelections,
} from '@/lib/menuCustomizations'
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

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

function isRecordMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  return (error as { code?: unknown }).code === 'P2025'
}

function toJson(value: unknown): Prisma.InputJsonValue {
  if (value === undefined || value === null) {
    return [] as unknown as Prisma.InputJsonValue
  }
  return value as Prisma.InputJsonValue
}

export async function POST(req: Request) {
  const restaurant = await resolveRestaurantFromRequest(req)
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }
  const payload =
    body && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : {}

  try {
    const sessionId = String(payload.sessionId ?? '')
    const itemId = String(payload.itemId ?? '')
    const hasQuantity = typeof payload.quantity === 'number'
    const hasEdits = Object.prototype.hasOwnProperty.call(
      payload,
      'edits'
    )
    const quantity = Number(payload.quantity ?? 0)

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
    if (
      !item ||
      item.restaurantId !== restaurant.id ||
      item.cart.session.restaurantId !== restaurant.id ||
      item.cart.sessionId !== sessionId
    ) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    const requesterClientKey = normalizeClientKey(
      payload.clientKey
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
      try {
        await prisma.cartItem.delete({
          where: { id: itemId }
        })
      } catch (error) {
        if (isRecordMissingError(error)) {
          return NextResponse.json({ removed: true, id: itemId })
        }
        throw error
      }

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
          restaurantId: restaurant.id,
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

    let nextEditsSource = hasEdits ? payload.edits : item.edits

    if (hasEdits && typeof item.menuItemId === 'string' && item.menuItemId) {
      const menuItem = await prisma.menuItem.findUnique({
        where: { id: item.menuItemId },
      })

      if (menuItem && menuItem.restaurantId === restaurant.id) {
        const customization = getMenuItemCustomization({
          id: menuItem.id,
          name: menuItem.name,
          description: menuItem.description,
          station: menuItem.station,
          allergens: Array.isArray(menuItem.allergens)
            ? (menuItem.allergens as string[])
            : [],
        })

        if (hasCustomization(customization)) {
          const rawModifiers =
            isObject(nextEditsSource) &&
            isObject(nextEditsSource.modifiers)
              ? nextEditsSource.modifiers
              : undefined

          const validation = validateModifierSelections(
            customization,
            rawModifiers
          )

          if (!validation.ok) {
            return NextResponse.json(
              {
                error: 'INVALID_MODIFIERS',
                detail: validation.error,
              },
              { status: 400 }
            )
          }

          const summary = buildModifierSummary(
            customization,
            validation.normalized
          )
          const delta = calculateModifierDelta(
            customization,
            validation.normalized
          )
          const allergens = collectModifierAllergens(
            customization,
            validation.normalized,
            Array.isArray(menuItem.allergens)
              ? (menuItem.allergens as string[])
              : []
          )

          const editsBase = isObject(nextEditsSource)
            ? { ...nextEditsSource }
            : {}

          editsBase.modifiers = validation.normalized
          editsBase.modifierPriceDelta = delta
          if (summary.length > 0) {
            editsBase.modifierSummary = summary
          } else {
            delete editsBase.modifierSummary
          }

          nextEditsSource = editsBase
          nextData.unitPrice = Number((menuItem.basePrice + delta).toFixed(2))
          nextData.vatRate = menuItem.vatRate
          nextData.allergens = toJson(allergens)
        }
      }
    }

    const keyForWrite = ownerClientKey ?? requesterClientKey
    if (hasEdits || hasQuantity) {
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
          restaurantId: restaurant.id,
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
          restaurantId: restaurant.id,
          sessionId,
          tableId: item.cart.session.tableId
        }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    if (isRecordMissingError(error)) {
      return NextResponse.json(
        { error: 'ITEM_NOT_FOUND' },
        { status: 409 }
      )
    }

    console.error('cart_update_failed', {
      sessionId: String(payload.sessionId ?? ''),
      itemId: String(payload.itemId ?? ''),
      error,
    })
    return NextResponse.json(
      { error: 'CART_UPDATE_FAILED' },
      { status: 500 }
    )
  }
}
