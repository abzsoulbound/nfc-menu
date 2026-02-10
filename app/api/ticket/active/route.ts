import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStaff } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const tickets = await prisma.kitchenTicket.findMany({
    where: { readyAt: null },
    include: { items: true }
  })

  return NextResponse.json(tickets)
}
