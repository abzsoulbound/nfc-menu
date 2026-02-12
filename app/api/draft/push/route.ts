import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStaff } from '@/lib/auth'

export async function POST(req: Request) {
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

  if (!session || !session.tag.assignment) {
    return NextResponse.json({ error: 'TABLE_NOT_ASSIGNED' }, { status: 400 })
  }
  if (!session.cart) {
    return NextResponse.json({ error: 'CART_NOT_FOUND' }, { status: 404 })
  }

  const draft = await prisma.tableDraft.create({
    data: {
      tableId: session.tag.assignment.id,
      items: {
        create: session.cart.items.map(i => ({
          memberId: 0,
          name: i.name,
          quantity: i.quantity
        }))
      }
    }
  })

  await prisma.cartItem.deleteMany({
    where: { cartId: session.cart.id }
  })

  return NextResponse.json({ draftId: draft.id, tableId: session.tag.assignment.id })
}
