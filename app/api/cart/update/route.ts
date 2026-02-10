import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { sessionId, itemId, quantity } = await req.json()
  if (!sessionId || !itemId || typeof quantity !== 'number') {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: { cart: true }
  })
  if (!item || item.cart.sessionId !== sessionId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const updated = await prisma.cartItem.update({
    where: { id: itemId },
    data: { quantity }
  })

  return NextResponse.json(updated)
}
