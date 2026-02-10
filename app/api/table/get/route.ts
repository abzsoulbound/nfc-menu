import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { tableId } = await req.json()

  const drafts = await prisma.tableDraft.findMany({
    where: { tableId },
    include: { items: true }
  })

  return NextResponse.json(drafts)
}
