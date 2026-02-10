import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { itemId } = await req.json()

  await prisma.cartItem.delete({
    where: { id: itemId }
  })

  return NextResponse.json({ removed: true })
}
