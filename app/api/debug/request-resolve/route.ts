export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { resolveRestaurantFromRequest } from '@/lib/restaurants'

export async function POST(req: Request) {
  try {
    console.log('test-resolve-from-request: headers', {
      'host': req.headers.get('host'),
      'x-forwarded-host': req.headers.get('x-forwarded-host'),
      'x-restaurant-context': req.headers.get('x-restaurant-context'),
      'x-restaurant-id': req.headers.get('x-restaurant-id'),
    })
    
    const restaurant = await resolveRestaurantFromRequest(req)
    
    return NextResponse.json({
      status: 'ok',
      found: !!restaurant,
      restaurant
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: String(error),
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
