import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSystem } from '@/lib/auth'
import { resolveRestaurantFromRequest } from '@/lib/restaurants'

export async function POST(req: Request) {
  try {
    requireSystem(req)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  const restaurant = await resolveRestaurantFromRequest(req)

  const { deviceId } = await req.json()
  if (!deviceId) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const updated = await prisma.deviceSession.updateMany({
    where: {
      id: deviceId,
      restaurantId: restaurant.id,
    },
    data: { revoked: true }
  })
  if (updated.count === 0) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({ revoked: true })
}
