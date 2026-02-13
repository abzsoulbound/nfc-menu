import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStaff } from '@/lib/auth'
import { resolveRestaurantFromRequest } from '@/lib/restaurants'

export async function POST(req: Request) {
  const restaurant = await resolveRestaurantFromRequest(req)
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const body = await req.json()
  const sessionId =
    typeof body?.sessionId === 'string'
      ? body.sessionId.trim()
      : ''
  if (!sessionId) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      cart: { include: { items: true } },
      tag: { include: { assignment: true } }
    }
  })

  if (session && session.restaurantId !== restaurant.id) {
    return NextResponse.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 })
  }

  if (!session || !session.tag.assignment) {
    return NextResponse.json({ error: 'TABLE_NOT_ASSIGNED' }, { status: 400 })
  }
  if (!session.cart) {
    return NextResponse.json({ error: 'CART_NOT_FOUND' }, { status: 404 })
  }
  if (session.cart.restaurantId !== restaurant.id) {
    return NextResponse.json({ error: 'CART_NOT_FOUND' }, { status: 404 })
  }
  if (session.tag.assignment.restaurantId !== restaurant.id) {
    return NextResponse.json({ error: 'TABLE_NOT_ASSIGNED' }, { status: 400 })
  }

  const draft = await prisma.tableDraft.create({
    data: {
      restaurantId: restaurant.id,
      tableId: session.tag.assignment.id,
      items: {
        create: session.cart.items.map(i => ({
          restaurantId: restaurant.id,
          memberId: 0,
          name: i.name,
          quantity: i.quantity
        }))
      }
    }
  })

  await prisma.cartItem.deleteMany({
    where: {
      restaurantId: restaurant.id,
      cartId: session.cart.id
    }
  })

  return NextResponse.json({ draftId: draft.id, tableId: session.tag.assignment.id })
}
