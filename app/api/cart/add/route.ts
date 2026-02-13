import { NextResponse } from 'next/server'
import { Prisma, Station } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { findMenuItemForCart } from '@/lib/menuCatalog'
import { appendSystemEvent } from '@/lib/events'
import { withEditConfirmation } from '@/lib/itemEdits'
import { resolveRestaurantFromRequest } from '@/lib/restaurants'
import {
  buildModifierSummary,
  calculateModifierDelta,
  collectModifierAllergens,
  getMenuItemCustomization,
  hasCustomization,
  validateModifierSelections,
} from '@/lib/menuCustomizations'

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
  const restaurant = await resolveRestaurantFromRequest(req)
  const body = await req.json()
  const sessionId = String(body?.sessionId ?? '')
  const quantity = Number(body?.quantity ?? 0)

  if (!sessionId || !Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const cart = await prisma.sessionCart.findFirst({
    where: {
      sessionId,
      restaurantId: restaurant.id,
    },
    include: { session: true }
  })
  if (!cart) {
    return NextResponse.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 })
  }

  const menuItem = await findMenuItemForCart({
    menuItemId: typeof body?.menuItemId === 'string' ? body.menuItemId : undefined,
    name: typeof body?.name === 'string' ? body.name : undefined,
    restaurantId: restaurant.id,
    restaurantSlug: restaurant.slug,
  })

  if (menuItem && !menuItem.available) {
    return NextResponse.json(
      { error: 'ITEM_UNAVAILABLE' },
      { status: 409 }
    )
  }

  const itemName =
    menuItem?.name ??
    (typeof body?.name === 'string' && body.name.trim().length > 0
      ? body.name.trim()
      : 'Item')

  const station = toStation(
    body?.station,
    menuItem?.station ?? 'KITCHEN'
  )
  let allergens =
    menuItem?.allergens ??
    (Array.isArray(body?.allergens) ? body.allergens : [])
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
  let nextEdits: unknown = body?.edits
  let unitPrice = menuItem?.basePrice ?? Number(body?.unitPrice ?? 0)

  if (menuItem && hasCustomization(customization)) {
    const rawModifiers = isObject(body?.edits) && isObject(body.edits.modifiers)
      ? body.edits.modifiers
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
    allergens = collectModifierAllergens(
      customization,
      validation.normalized,
      Array.isArray(menuItem.allergens)
        ? (menuItem.allergens as string[])
        : []
    )
    const editsBase = isObject(body?.edits)
      ? { ...body.edits }
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
    body?.clientKey
  )

  const item = await prisma.cartItem.create({
    data: {
      restaurantId: restaurant.id,
      cartId: cart.id,
      menuItemId: menuItem?.id ?? null,
      name: itemName,
      quantity,
      unitPrice,
      vatRate: menuItem?.vatRate ?? Number(body?.vatRate ?? 0),
      allergens: toJson(allergens),
      station,
      edits:
        editsWithMeta === undefined
          ? undefined
          : (editsWithMeta as Prisma.InputJsonValue),
    }
  })

  await prisma.session.updateMany({
    where: {
      id: cart.sessionId,
      restaurantId: restaurant.id,
    },
    data: {
      lastActivityAt: new Date()
    }
  })

  await appendSystemEvent(
    'item_added',
    {
      cartId: cart.id,
      itemId: item.id,
      menuItemId: item.menuItemId,
      name: item.name,
      quantity: item.quantity
    },
    {
      req,
      restaurantId: restaurant.id,
      sessionId: cart.sessionId,
      tableId: cart.session.tableId
    }
  )

  return NextResponse.json(item)
}
