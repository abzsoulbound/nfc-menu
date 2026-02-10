import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSystem } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    requireSystem(req)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { deviceId } = await req.json()
  if (!deviceId) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  await prisma.deviceSession.update({
    where: { id: deviceId },
    data: { revoked: true }
  })

  return NextResponse.json({ revoked: true })
}
