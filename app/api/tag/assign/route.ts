import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { tagId, tableNo } = await req.json()

  const assignment = await prisma.tableAssignment.upsert({
    where: { tagId },
    update: { tableNo },
    create: { tagId, tableNo }
  })

  return NextResponse.json(assignment)
}
