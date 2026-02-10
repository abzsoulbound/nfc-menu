import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { tagId } = await req.json()
  if (!tagId) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const tag = await prisma.nfcTag.findUnique({
    where: { id: tagId },
    select: { id: true }
  })
  if (!tag) {
    await prisma.nfcTag.create({
      data: { id: tagId }
    })
  }

  const session = await prisma.session.create({
    data: { tagId }
  })

  await prisma.sessionCart.create({
    data: { sessionId: session.id }
  })

  return NextResponse.json({ sessionId: session.id, id: session.id })
}
