import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStaff } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { ticketId } = await req.json()
  if (!ticketId) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const ticket = await prisma.kitchenTicket.update({
    where: { id: ticketId },
    data: { readyAt: new Date() }
  })

  return NextResponse.json(ticket)
}
