import { Prisma, Station } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { findMenuItemForCart } from '@/lib/menuCatalog'
import { appendSystemEvent } from '@/lib/events'
import { withEditConfirmation } from '@/lib/itemEdits'
import {
  buildModifierSummary,
  calculateModifierDelta,
  collectModifierAllergens,
  getMenuItemCustomization,
  hasCustomization,
  validateModifierSelections,
} from '@/lib/menuCustomizations'
import {
  apiErrorResponse,
  jsonWithTenantRequestId,
  withTenant,
} from '@/lib/api/withTenant'

function toJson(value: unknown): Prisma.InputJsonValue {
  if (value === undefined || value === null) {
    return [] as unknown as Prisma.InputJsonValue
  }
  return value as Prisma.InputJsonValue
}

function toStation(value: unknown, fallback: Station): Station {
  if (typeof value !== 'string') return fallback
  return value.toUpperCase() === 'BAR' ? 'BAR' : 'KITCHEN'
}

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
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
    const quantity = Number(payload.quantity ?? 0)

    if (!sessionId || !Number.isFinite(quantity) || quantity <= 0) {
      return apiErrorResponse({
        requestId,
        error: 'BAD_REQUEST',
        status: 400,
        message: 'Session ID and quantity are required.',
      })
    }

    const cart = await prisma.sessionCart.findFirst({
      where: {
        sessionId,
        restaurantId: restaurant.id,
      },
      include: { session: true },
    })
    if (!cart) {
      return apiErrorResponse({
        requestId,
        error: 'SESSION_NOT_FOUND',
        status: 404,
      })
    }

    const menuItem = await findMenuItemForCart({
      menuItemId:
        typeof payload.menuItemId === 'string'
          ? payload.menuItemId
          : undefined,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      restaurantId: restaurant.id,
      restaurantSlug: restaurant.slug,
    })

    if (menuItem && !menuItem.available) {
      return apiErrorResponse({
        requestId,
        error: 'ITEM_UNAVAILABLE',
        status: 409,
      })
    }

    const itemName =
      menuItem?.name ??
      (typeof payload.name === 'string' && payload.name.trim().length > 0
        ? payload.name.trim()
        : 'Item')

    const station = toStation(
      payload.station,
      menuItem?.station ?? 'KITCHEN'
    )
    let allergens =
      menuItem?.allergens ??
      (Array.isArray(payload.allergens) ? payload.allergens : [])
    const customization =
      menuItem?.id
        ? getMenuItemCustomization({
            id: menuItem.id,
            name: menuItem.name,
            description: menuItem.description,
            station: menuItem.station,
            allergens:
              Array.isArray(menuItem.allergens)
                ? (menuItem.allergens as string[])
                : [],
          })
        : null
    let nextEdits: unknown = payload.edits
    let unitPrice = menuItem?.basePrice ?? Number(payload.unitPrice ?? 0)

    if (menuItem && hasCustomization(customization)) {
      const rawModifiers =
        isObject(payload.edits) && isObject(payload.edits.modifiers)
          ? payload.edits.modifiers
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
      allergens = collectModifierAllergens(
        customization,
        validation.normalized,
        Array.isArray(menuItem.allergens)
          ? (menuItem.allergens as string[])
          : []
      )
      const editsBase = isObject(payload.edits)
        ? { ...payload.edits }
        : {}

      editsBase.modifiers = validation.normalized
      editsBase.modifierPriceDelta = delta
      if (summary.length > 0) {
        editsBase.modifierSummary = summary
      } else {
        delete editsBase.modifierSummary
      }
      nextEdits = editsBase
      unitPrice = Number((menuItem.basePrice + delta).toFixed(2))
    }

    const editsWithMeta = withEditConfirmation(
      nextEdits,
      false,
      payload.clientKey
    )

    const item = await prisma.cartItem.create({
      data: {
        restaurantId: restaurant.id,
        cartId: cart.id,
        menuItemId: menuItem?.id ?? null,
        name: itemName,
        quantity,
        unitPrice,
        vatRate: menuItem?.vatRate ?? Number(payload.vatRate ?? 0),
        allergens: toJson(allergens),
        station,
        edits:
          editsWithMeta === undefined
            ? undefined
            : (editsWithMeta as Prisma.InputJsonValue),
      },
    })

    await prisma.session.updateMany({
      where: {
        id: cart.sessionId,
        restaurantId: restaurant.id,
      },
      data: {
        lastActivityAt: new Date(),
      },
    })

    await appendSystemEvent(
      'item_added',
      {
        cartId: cart.id,
        itemId: item.id,
        menuItemId: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
      },
      {
        req,
        restaurantId: restaurant.id,
        sessionId: cart.sessionId,
        tableId: cart.session.tableId,
      }
    )

    return jsonWithTenantRequestId(item, requestId)
  })
}
