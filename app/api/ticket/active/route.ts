import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStaff } from '@/lib/auth'
import { resolveRestaurantFromRequest } from '@/lib/restaurants'

export async function GET(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  const restaurant = await resolveRestaurantFromRequest(req)

  const tickets = await prisma.kitchenTicket.findMany({
    where: {
      restaurantId: restaurant.id,
      readyAt: null,
    },
    include: { items: true }
  })

  return NextResponse.json(tickets)
}
