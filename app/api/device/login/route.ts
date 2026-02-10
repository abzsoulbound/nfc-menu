import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSystem } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    requireSystem(req)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { role } = await req.json()
  if (typeof role !== 'string' || role.length === 0) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const device = await prisma.deviceSession.create({
    data: { role }
  })

  return NextResponse.json({ deviceId: device.id })
}
