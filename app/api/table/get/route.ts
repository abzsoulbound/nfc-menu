import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { tableId } = await req.json()
  if (!tableId) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const drafts = await prisma.tableDraft.findMany({
    where: { tableId },
    include: { items: true }
  })

  return NextResponse.json(drafts)
}
