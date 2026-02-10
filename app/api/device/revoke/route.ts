import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { deviceId } = await req.json()

  await prisma.deviceSession.update({
    where: { id: deviceId },
    data: { revoked: true }
  })

  return NextResponse.json({ revoked: true })
}
