import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { tagId } = await req.json()

  const session = await prisma.session.create({
    data: { tagId }
  })

  await prisma.sessionCart.create({
    data: { sessionId: session.id }
  })

  return NextResponse.json({ sessionId: session.id })
}
