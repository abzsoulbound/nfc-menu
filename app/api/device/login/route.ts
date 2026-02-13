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

  const { role } = await req.json()
  if (typeof role !== 'string' || role.length === 0) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const device = await prisma.deviceSession.create({
    data: {
      restaurantId: restaurant.id,
      role,
    }
  })

  return NextResponse.json({ deviceId: device.id })
}
