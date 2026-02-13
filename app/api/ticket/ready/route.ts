import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStaff } from '@/lib/auth'
import { resolveRestaurantFromRequest } from '@/lib/restaurants'

export async function POST(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  const restaurant = await resolveRestaurantFromRequest(req)

  const { ticketId } = await req.json()
  if (!ticketId) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const result = await prisma.kitchenTicket.updateMany({
    where: {
      id: ticketId,
      restaurantId: restaurant.id,
    },
    data: { readyAt: new Date() }
  })
  if (result.count === 0) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const ticket = await prisma.kitchenTicket.findUnique({
    where: { id: ticketId },
  })
  if (!ticket || ticket.restaurantId !== restaurant.id) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json(ticket)
}
