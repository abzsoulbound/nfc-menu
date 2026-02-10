import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { sessionId } = await req.json()

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

  const draft = await prisma.tableDraft.create({
    data: {
      tableId: session.tag.assignment.id,
      items: {
        create: session.cart!.items.map(i => ({
          memberId: 0,
          name: i.name,
          quantity: i.quantity
        }))
      }
    }
  })

  await prisma.cartItem.deleteMany({
    where: { cartId: session.cart!.id }
  })

  return NextResponse.json({ draftId: draft.id })
}
