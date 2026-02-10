import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { itemId, quantity } = await req.json()

  const item = await prisma.cartItem.update({
    where: { id: itemId },
    data: { quantity }
  })

  return NextResponse.json(item)
}
