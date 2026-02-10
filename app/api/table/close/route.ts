import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { tableId } = await req.json()

  await prisma.kitchenTicket.deleteMany({
    where: { tableId }
  })

  return NextResponse.json({ closed: true })
}
