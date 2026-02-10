import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { sessionId } = await req.json()
  if (!sessionId) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const cart = await prisma.sessionCart.findUnique({
    where: { sessionId },
    include: { items: true }
  })

  if (!cart) {
    return NextResponse.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json(cart)
}
