import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireStaff } from '@/lib/auth'
import { appendSystemEvent } from '@/lib/events'
import { getTableGroupByAssignmentId } from '@/lib/tableGroups'

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

  const tableGroup = await getTableGroupByAssignmentId(tableId)
  if (!tableGroup) {
    return NextResponse.json(
      { error: 'TABLE_NOT_FOUND' },
      { status: 404 }
    )
  }
  const groupTableIds = tableGroup.assignments.map(
    assignment => assignment.id
  )
  const masterTableId = tableGroup.master.id
  const closedAt = new Date()

  await prisma.tableAssignment.updateMany({
    where: { id: { in: groupTableIds } },
    data: {
      closedAt,
      closedPaid: false,
      locked: true
    }
  })

  await prisma.session.updateMany({
    where: {
      tableId: { in: groupTableIds },
      status: 'ACTIVE'
    },
    data: {
      status: 'CLOSED',
      closedAt
    }
  })

  await appendSystemEvent(
    'table_closed',
    {
      tableId: masterTableId,
      paid: false,
      groupedTableIds: groupTableIds
    },
    { req, tableId: masterTableId }
  )

  return NextResponse.json({
    closed: true,
    table: {
      id: masterTableId,
      closedAt,
      closedPaid: false
    }
  })
}
