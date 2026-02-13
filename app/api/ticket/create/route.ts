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

  const { tableId } = await req.json()
  if (!tableId) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const drafts = await prisma.tableDraft.findMany({
    where: {
      tableId,
      restaurantId: restaurant.id,
    },
    include: { items: true }
  })

  if (drafts.length === 0) {
    return NextResponse.json({ error: 'NO_DRAFTS' }, { status: 400 })
  }

  const ticket = await prisma.kitchenTicket.create({
    data: {
      restaurantId: restaurant.id,
      tableId,
      items: {
        create: drafts.flatMap(d =>
          d.items.map(i => ({
            restaurantId: restaurant.id,
            name: i.name,
            quantity: i.quantity,
            station: 'kitchen'
          }))
        )
      }
    }
  })

  await prisma.draftItem.deleteMany({
    where: {
      restaurantId: restaurant.id,
      draftId: { in: drafts.map(d => d.id) },
    }
  })

  await prisma.tableDraft.deleteMany({
    where: {
      restaurantId: restaurant.id,
      tableId,
    }
  })

  return NextResponse.json({ ticketId: ticket.id })
}
