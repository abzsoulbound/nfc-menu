export const runtime = 'nodejs'

import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const restaurants = await prisma.restaurant.findMany({
      select: { id: true, slug: true, domain: true }
    })
    
    return NextResponse.json({
      status: 'ok',
      dbConnected: true,
      restaurantCount: restaurants.length,
      restaurants
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: String(error),
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
