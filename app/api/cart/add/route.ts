import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { sessionId, name, quantity } = await req.json()
  if (!sessionId || !name || typeof quantity !== 'number' || quantity <= 0) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const cart = await prisma.sessionCart.findUnique({
    where: { sessionId }
  })
  if (!cart) {
    return NextResponse.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 })
  }

  const item = await prisma.cartItem.create({
    data: { cartId: cart.id, name, quantity }
  })

  return NextResponse.json(item)
}
