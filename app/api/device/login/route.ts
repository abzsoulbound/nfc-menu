import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { role } = await req.json()

  const device = await prisma.deviceSession.create({
    data: { role }
  })

  return NextResponse.json({ deviceId: device.id })
}
