import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const tickets = await prisma.kitchenTicket.findMany({
    where: { readyAt: null },
    include: { items: true }
  })

  return NextResponse.json(tickets)
}
