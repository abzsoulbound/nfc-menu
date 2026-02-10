import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { sessionId, name, quantity } = await req.json()

  const cart = await prisma.sessionCart.findUnique({
    where: { sessionId }
  })

  const item = await prisma.cartItem.create({
    data: { cartId: cart!.id, name, quantity }
  })

  return NextResponse.json(item)
}
