export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { resolveRestaurantByDomain, normalizeDomain } from '@/lib/restaurants'

export async function GET(req: Request) {
  try {
    const hostname = new URL(req.url).hostname || 'nfc-menu.vercel.app'
    const normalized = normalizeDomain(hostname)
    
    console.log('test-domain-resolve', { hostname, normalized })
    
    const restaurant = await resolveRestaurantByDomain(hostname)
    
    return NextResponse.json({
      status: 'ok',
      input: { hostname, normalized },
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
