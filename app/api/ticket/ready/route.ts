import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { ticketId } = await req.json()

  const ticket = await prisma.kitchenTicket.update({
    where: { id: ticketId },
    data: { readyAt: new Date() }
  })

  return NextResponse.json(ticket)
}
