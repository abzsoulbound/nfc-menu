export const runtime = 'nodejs'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { appendSystemEvent } from '@/lib/events'
import { ASSIST_EDIT_UNLOCK_MS } from '@/lib/constants'
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
        return apiErrorResponse({
          requestId,
          error: 'BAD_REQUEST',
          status: 400,
          message: 'Session ID, item ID, and an update patch are required.',
        })
      }
      if (
        hasQuantity &&
        (!Number.isInteger(quantity) || quantity < 0)
      ) {
        return apiErrorResponse({
          requestId,
          error: 'BAD_REQUEST',
          status: 400,
          message: 'Quantity must be a non-negative integer.',
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

      if (hasQuantity && quantity === 0) {
        try {
          await prisma.cartItem.delete({
            where: { id: itemId },
          })
        } catch (error) {
          if (isRecordMissingError(error)) {
            return jsonWithTenantRequestId(
              { removed: true, id: itemId },
              requestId
            )
          }
          throw error
        }

        await prisma.session.update({
          where: { id: sessionId },
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

        return jsonWithTenantRequestId(
          { removed: true, id: itemId },
          requestId
        )
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
              return apiErrorResponse({
                requestId,
                error: 'INVALID_MODIFIERS',
                status: 400,
                message: validation.error ?? 'Invalid modifier selection.',
              })
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
        data: nextData,
      })

      await prisma.session.update({
        where: { id: sessionId },
        data: { lastActivityAt: new Date() },
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
                quantity: updated.quantity,
              },
          {
            req,
            restaurantId: restaurant.id,
            sessionId,
            tableId: item.cart.session.tableId,
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
                itemId: updated.id,
              },
          {
            req,
            restaurantId: restaurant.id,
            sessionId,
            tableId: item.cart.session.tableId,
          }
        )
      }

      return jsonWithTenantRequestId(updated, requestId)
    } catch (error) {
      if (isRecordMissingError(error)) {
        return apiErrorResponse({
          requestId,
          error: 'ITEM_NOT_FOUND',
          status: 409,
        })
      }

      console.error('cart_update_failed', {
        requestId,
        sessionId: String(payload.sessionId ?? ''),
        itemId: String(payload.itemId ?? ''),
        error,
      })
      return apiErrorResponse({
        requestId,
        error: 'CART_UPDATE_FAILED',
        status: 500,
        message: 'Could not update basket item.',
      })
    }
  })
}
