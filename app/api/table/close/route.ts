import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStaff } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { tableId } = await req.json()
  if (!tableId) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  await prisma.kitchenTicket.deleteMany({
    where: { tableId }
  })

  return NextResponse.json({ closed: true })
}
