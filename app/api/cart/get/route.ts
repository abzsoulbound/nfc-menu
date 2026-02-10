import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { sessionId } = await req.json()

  const cart = await prisma.sessionCart.findUnique({
    where: { sessionId },
    include: { items: true }
  })

  return NextResponse.json(cart)
}
