import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStaff } from '@/lib/auth'
import { appendSystemEvent } from '@/lib/events'

export async function POST(req: Request) {
  try {
    requireStaff(req)
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { tableId } = await req.json()
  if (!tableId) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const table = await prisma.tableAssignment.update({
    where: { id: tableId },
    data: {
      closedAt: new Date(),
      closedPaid: false,
      locked: true
    }
  })

  await prisma.session.updateMany({
    where: {
      tableId,
      status: 'ACTIVE'
    },
    data: {
      status: 'CLOSED',
      closedAt: new Date()
    }
  })

  await appendSystemEvent(
    'table_closed',
    { tableId, paid: false },
    { req, tableId }
  )

  return NextResponse.json({
    closed: true,
    table: {
      id: table.id,
      closedAt: table.closedAt,
      closedPaid: table.closedPaid
    }
  })
}
