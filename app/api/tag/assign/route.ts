import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStaff } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { tagId, tableNo } = await req.json()
  if (!tagId || typeof tableNo !== 'number') {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const assignment = await prisma.tableAssignment.upsert({
    where: { tagId },
    update: { tableNo },
    create: { tagId, tableNo }
  })

  return NextResponse.json(assignment)
}
