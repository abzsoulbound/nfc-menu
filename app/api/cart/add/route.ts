import { NextResponse } from 'next/server'
import { Prisma, Station } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { findMenuItemForCart } from '@/lib/menuCatalog'
import { appendSystemEvent } from '@/lib/events'
import { withEditConfirmation } from '@/lib/itemEdits'

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

export async function POST(req: Request) {
  const body = await req.json()
  const sessionId = String(body?.sessionId ?? '')
  const quantity = Number(body?.quantity ?? 0)

  if (!sessionId || !Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const cart = await prisma.sessionCart.findUnique({
    where: { sessionId },
    include: { session: true }
  })
  if (!cart) {
    return NextResponse.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 })
  }

  const menuItem = await findMenuItemForCart({
    menuItemId: typeof body?.menuItemId === 'string' ? body.menuItemId : undefined,
    name: typeof body?.name === 'string' ? body.name : undefined
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
  const allergens =
    menuItem?.allergens ??
    (Array.isArray(body?.allergens) ? body.allergens : [])
  const editsWithMeta = withEditConfirmation(
    body?.edits,
    false,
    body?.clientKey
  )

  const item = await prisma.cartItem.create({
    data: {
      cartId: cart.id,
      menuItemId: menuItem?.id ?? null,
      name: itemName,
      quantity,
      unitPrice: menuItem?.basePrice ?? Number(body?.unitPrice ?? 0),
      vatRate: menuItem?.vatRate ?? Number(body?.vatRate ?? 0),
      allergens: toJson(allergens),
      station,
      edits:
        editsWithMeta === undefined
          ? undefined
          : (editsWithMeta as Prisma.InputJsonValue),
    }
  })

  await prisma.session.update({
    where: { id: cart.sessionId },
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
      sessionId: cart.sessionId,
      tableId: cart.session.tableId
    }
  )

  return NextResponse.json(item)
}
